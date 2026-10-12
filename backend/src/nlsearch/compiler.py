"""Validate a JSON filter against a Catalog and compile it to Django ORM conditions.

Grammar:
  node      := {"and": [node, ...]} | {"or": [node, ...]} | {"not": node} | condition | template
  condition := {"field": <catalogue key>, "op": <operator>, "value": <value>}
  template  := {"template": <catalogue key>, "params": {...}}

The filter is untrusted (it comes from an LLM or from the URL), so every field, operator,
value and template param is checked against the catalogue. Field names and ORM paths come only
from the catalogue; values are passed to the ORM as bound parameters.
"""

from datetime import date, datetime

from django.db.models import Exists, OuterRef, Q


class FilterValidationError(ValueError):
    pass


def compile_filter(catalog, node):
    """Return (annotations, q) for a validated filter, or raise FilterValidationError."""
    compiler = _Compiler(catalog)
    q = compiler.compile(node)
    return compiler.annotations, q


def apply_filter(catalog, queryset, node):
    annotations, q = compile_filter(catalog, node)
    if annotations:
        queryset = queryset.annotate(**annotations)
    return queryset.filter(q)


class _Compiler:
    def __init__(self, catalog):
        self.catalog = catalog
        self.annotations = {}
        self.condition_count = 0
        self.template_uses = 0

    def compile(self, node, depth=1):
        if not isinstance(node, dict):
            raise FilterValidationError("Each filter node must be an object")
        if depth > self.catalog.max_depth:
            raise FilterValidationError(f"Filter is nested deeper than {self.catalog.max_depth} levels")
        if "and" in node or "or" in node:
            key = "and" if "and" in node else "or"
            children = node[key]
            if not isinstance(children, list) or not children:
                raise FilterValidationError(f"'{key}' must be a non-empty list")
            q = None
            for child in children:
                child_q = self.compile(child, depth + 1)
                q = child_q if q is None else (q & child_q if key == "and" else q | child_q)
            return q
        if "not" in node:
            return ~self.compile(node["not"], depth + 1)
        self.condition_count += 1
        if self.condition_count > self.catalog.max_conditions:
            raise FilterValidationError(f"Filter has more than {self.catalog.max_conditions} conditions")
        if "field" in node:
            return self._condition(node)
        if "template" in node:
            return self._template(node)
        raise FilterValidationError("Unknown filter node")

    def _condition(self, node):
        name = node.get("field")
        spec = self.catalog.fields.get(name) if isinstance(name, str) else None
        if spec is None:
            raise FilterValidationError(f"Field '{name}' is not allowed")
        op = node.get("op")
        if op not in spec.allowed_operators():
            raise FilterValidationError(f"Operator '{op}' is not allowed for field '{name}'")
        value = coerce(spec, op, node.get("value"), name)
        lookup = "exact" if op == "eq" else op
        condition = {f"{spec.path}__{lookup}": value}
        if spec.exists_in is not None:
            related = spec.exists_in().filter(**{spec.exists_ref: OuterRef("pk")}, **condition)
            return Q(Exists(related))
        return Q(**condition)

    def _template(self, node):
        name = node.get("template")
        template = self.catalog.templates.get(name) if isinstance(name, str) else None
        if template is None:
            raise FilterValidationError(f"Template '{name}' is not allowed")
        params = node.get("params", {})
        if not isinstance(params, dict):
            raise FilterValidationError("Template params must be an object")
        unknown = set(params) - set(template.params)
        if unknown:
            raise FilterValidationError(f"Unknown params for template '{name}': {', '.join(sorted(unknown))}")
        clean = {}
        for key, spec in template.params.items():
            if key not in params:
                if spec.get("required"):
                    raise FilterValidationError(f"Template '{name}' requires '{key}'")
                continue
            clean[key] = _coerce_param(name, key, spec, params[key])
        self.template_uses += 1
        annotations, q = template.build(clean, f"nl_{name}_{self.template_uses}")
        self.annotations.update(annotations)
        return q


def _coerce_param(template, key, spec, value):
    kind = spec.get("type", "string")
    if kind == "number":
        if isinstance(value, bool) or not isinstance(value, int | float):
            raise FilterValidationError(f"'{template}.{key}' must be a number")
        return value
    if kind == "enum":
        if value not in spec.get("choices", []):
            raise FilterValidationError(f"'{template}.{key}' must be one of {', '.join(spec['choices'])}")
        return value
    if not isinstance(value, str):
        raise FilterValidationError(f"'{template}.{key}' must be a string")
    return value


def coerce(spec, op, value, name="field"):
    if op == "isnull":
        if not isinstance(value, bool):
            raise FilterValidationError(f"'isnull' on '{name}' needs true or false")
        return value
    if op == "in":
        if not isinstance(value, list) or not value:
            raise FilterValidationError(f"'in' on '{name}' needs a non-empty list")
        return [coerce(spec, "eq", item, name) for item in value]
    kind = spec.type
    try:
        if kind == "enum":
            choices = spec.choices or []
            if value not in choices:
                raise FilterValidationError(f"'{value}' is not a valid value for '{name}'")
            return choices[value] if isinstance(choices, dict) else value
        if kind == "number":
            if isinstance(value, bool) or not isinstance(value, int | float):
                raise FilterValidationError(f"'{name}' needs a number")
            return value
        if kind == "boolean":
            if not isinstance(value, bool):
                raise FilterValidationError(f"'{name}' needs true or false")
            return value
        if kind == "date":
            return date.fromisoformat(value)
        if kind == "datetime":
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                from datetime import UTC

                parsed = parsed.replace(tzinfo=UTC)
            return parsed
        if not isinstance(value, str):
            raise FilterValidationError(f"'{name}' needs text")
        return value
    except (TypeError, ValueError) as exc:
        if isinstance(exc, FilterValidationError):
            raise
        raise FilterValidationError(f"Invalid value for '{name}': {value!r}") from exc


def describe_filter(catalog, node):
    """Human-readable text shown as 'Interpreted as'; 1:1 with the filter structure."""
    if "and" in node:
        return "(" + " AND ".join(describe_filter(catalog, c) for c in node["and"]) + ")"
    if "or" in node:
        return "(" + " OR ".join(describe_filter(catalog, c) for c in node["or"]) + ")"
    if "not" in node:
        return "NOT " + describe_filter(catalog, node["not"])
    if "field" in node:
        from nlsearch.catalog import OPERATOR_WORDS

        spec = catalog.fields[node["field"]]
        label = spec.label or node["field"]
        value = node.get("value")
        if node["op"] == "isnull":
            return f"{label} is {'empty' if value else 'not empty'}"
        if isinstance(value, list):
            value = ", ".join(str(v) for v in value)
        if isinstance(value, bool):
            return f"{label}" if value else f"not {label}"
        return f"{label} {OPERATOR_WORDS[node['op']]} {value}"
    template = catalog.templates[node["template"]]
    params = node.get("params") or {}
    label = template.label or node["template"]
    if not params:
        return label
    return f"{label}(" + ", ".join(f"{k}={v}" for k, v in params.items()) + ")"

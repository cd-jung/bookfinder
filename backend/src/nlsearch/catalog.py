"""Catalogue types for natural language search.

A feature that wants "ask in plain language" search over one model defines a `Catalog`:
the allow-listed fields (with their ORM paths), optional server-side templates and the
question -> filter examples used as LLM few-shots and as the stub fixture. The compiler, the
prompt and the API all read from this one object, so they can never drift apart.
"""

from dataclasses import dataclass, field

OPERATORS = {
    "string": {"eq", "icontains", "in", "isnull"},
    "number": {"eq", "gt", "gte", "lt", "lte", "isnull"},
    "date": {"eq", "gt", "gte", "lt", "lte", "isnull"},
    "datetime": {"gt", "gte", "lt", "lte", "isnull"},
    "enum": {"eq", "in"},
    "boolean": {"eq"},
}

OPERATOR_WORDS = {
    "eq": "is",
    "icontains": "contains",
    "in": "is one of",
    "isnull": "is empty",
    "gt": "over",
    "gte": "at least",
    "lt": "under",
    "lte": "at most",
}


@dataclass
class Field:
    """One searchable field.

    path: ORM lookup path relative to the model (never shown to the LLM)
    exists_in: optional callable returning a related queryset; the condition then becomes an
               EXISTS subquery on that queryset joined by `exists_ref` (avoids duplicate rows)
    tokens: the column holds several values as "|a|b|" text; `eq` / `in` match whole tokens
            (the D1-friendly alternative to a join table)
    choices: enum values; a dict maps the catalogue value to the stored value
    """

    type: str
    path: str
    description: str
    label: str = ""
    choices: list | dict | None = None
    operators: set | None = None
    exists_in: object = None
    exists_ref: str = ""
    tokens: bool = False
    describe: object = None  # optional (op, value) -> text for "Interpreted as"

    def allowed_operators(self):
        return self.operators or OPERATORS[self.type]


@dataclass
class Template:
    """Server-defined condition the LLM can pick by name and fill with params.

    params: {name: {"type": "number"|"string"|"enum", "required": bool, "choices": [...]}}
    build(params, alias) -> (annotations: dict, q: Q)
    """

    description: str
    params: dict
    build: object
    label: str = ""


@dataclass
class Catalog:
    name: str
    subject: str  # e.g. "books in the BookFinder catalogue"
    model: object
    fields: dict
    templates: dict = field(default_factory=dict)
    examples: list = field(default_factory=list)  # [{"question", "expected_filter" | "expected_error"}]
    max_depth: int = 4
    max_conditions: int = 15
    max_question_length: int = 500

    def for_prompt(self):
        fields = {}
        for name, spec in self.fields.items():
            entry = {"type": spec.type, "operators": sorted(spec.allowed_operators()), "description": spec.description}
            if spec.type == "enum":
                entry["values"] = list(spec.choices)
            fields[name] = entry
        templates = {name: {"description": t.description, "params": t.params} for name, t in self.templates.items()}
        return {"fields": fields, "templates": templates}

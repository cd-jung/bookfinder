import pytest

from logs.catalog import LOG_CATALOG
from logs.models import RequestLog
from nlsearch.compiler import FilterValidationError, apply_filter, compile_filter, describe_filter

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "example", [e for e in LOG_CATALOG.examples if "expected_filter" in e], ids=lambda e: e["question"]
)
def test_every_catalog_example_compiles(example):
    compile_filter(LOG_CATALOG, example["expected_filter"])


@pytest.mark.parametrize(
    "node, message",
    [
        ({"field": "secret", "op": "eq", "value": 1}, "not allowed"),
        ({"field": "level", "op": "gt", "value": "ERROR"}, "Operator"),
        ({"field": "level", "op": "eq", "value": "DEBUG"}, "not a valid value"),
        ({"field": "status_code", "op": "eq", "value": "500"}, "needs a number"),
        ({"field": "status_code", "op": "eq", "value": True}, "needs a number"),
        ({"field": "path", "op": "in", "value": []}, "non-empty list"),
        ({"field": "path", "op": "isnull", "value": "yes"}, "true or false"),
        ({"field": "created_at", "op": "gt", "value": "yesterday"}, "Invalid value"),
        ({"and": []}, "non-empty list"),
        ({"template": "drop_table", "params": {}}, "Template"),
        ({"template": "recent", "params": {}}, "requires"),
        ({"template": "recent", "params": {"minutes": "60"}}, "must be a number"),
        ({"template": "recent", "params": {"minutes": 60, "x": 1}}, "Unknown params"),
        ({"template": "status_class", "params": {"class": "6xx"}}, "must be one of"),
        ("not an object", "must be an object"),
        ({"foo": 1}, "Unknown filter node"),
    ],
)
def test_invalid_filters_are_rejected(node, message):
    with pytest.raises(FilterValidationError, match=message):
        compile_filter(LOG_CATALOG, node)


def test_depth_limit():
    node = {"field": "level", "op": "eq", "value": "INFO"}
    for _ in range(4):
        node = {"not": node}
    with pytest.raises(FilterValidationError, match="deeper"):
        compile_filter(LOG_CATALOG, node)


def test_condition_limit():
    node = {"or": [{"field": "status_code", "op": "eq", "value": n} for n in range(16)]}
    with pytest.raises(FilterValidationError, match="more than 15"):
        compile_filter(LOG_CATALOG, node)


def _log(**kwargs):
    defaults = {
        "request_id": "r",
        "method": "GET",
        "path": "/api/x",
        "status_code": 200,
        "duration_ms": 10,
        "level": "INFO",
    }
    return RequestLog.objects.create(**{**defaults, **kwargs})


def test_compiled_filter_returns_only_matching_rows():
    slow = _log(duration_ms=900)
    _log(duration_ms=20)
    failed_post = _log(method="POST", path="/api/rag/answers", status_code=503, level="ERROR")
    node = {
        "or": [
            {"field": "duration_ms", "op": "gt", "value": 500},
            {"template": "status_class", "params": {"class": "5xx"}},
        ]
    }
    assert set(apply_filter(LOG_CATALOG, RequestLog.objects.all(), node)) == {slow, failed_post}


def test_not_and_in_operators():
    get = _log(method="GET")
    _log(method="POST")
    assert list(
        apply_filter(LOG_CATALOG, RequestLog.objects.all(), {"not": {"field": "method", "op": "eq", "value": "POST"}})
    ) == [get]
    in_node = {"field": "method", "op": "in", "value": ["GET", "POST"]}
    assert apply_filter(LOG_CATALOG, RequestLog.objects.all(), in_node).count() == 2


def test_describe_filter_is_one_to_one():
    node = {
        "and": [
            {"field": "level", "op": "eq", "value": "ERROR"},
            {"template": "recent", "params": {"minutes": 60}},
            {"not": {"field": "path", "op": "icontains", "value": "health"}},
        ]
    }
    assert (
        describe_filter(LOG_CATALOG, node)
        == "(level is ERROR AND in the last N minutes(minutes=60) AND NOT path contains health)"
    )


def test_describe_filter_lists_and_isnull():
    assert (
        describe_filter(LOG_CATALOG, {"field": "method", "op": "in", "value": ["GET", "POST"]})
        == "method is one of GET, POST"
    )
    assert describe_filter(LOG_CATALOG, {"field": "message", "op": "isnull", "value": False}) == "message is not empty"

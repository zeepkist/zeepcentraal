use opentelemetry::{StringValue, baggage::BaggageExt, propagation::TextMapPropagator};
use opentelemetry_sdk::propagation::BaggagePropagator;
use std::collections::HashMap;

fn extract(header: String) -> opentelemetry::Context {
    BaggagePropagator::new().extract(&HashMap::from([("baggage".to_owned(), header)]))
}

#[test]
fn rejects_oversized_headers_before_parsing_even_with_a_valid_prefix() {
    let context = extract(format!("allowed=yes,large={}", "a".repeat(8192)));
    assert!(context.baggage().is_empty());
}

#[test]
fn byte_limit_applies_before_percent_decoding() {
    let context = extract(format!("allowed=yes,encoded={}", "%41".repeat(2731)));
    assert!(context.baggage().is_empty());
}

#[test]
fn invalid_entries_cannot_bypass_the_64_entry_parse_limit() {
    let context = extract(format!("{}allowed=yes", "=,".repeat(64)));
    assert!(context.baggage().is_empty());
}

#[test]
fn preserves_valid_encoded_baggage_and_the_first_64_entries() {
    let context = extract("level=Mixed%20Surfaces,round=1".to_owned());
    assert_eq!(
        context.baggage().get("level").map(StringValue::as_str),
        Some("Mixed Surfaces")
    );
    assert_eq!(
        context.baggage().get("round").map(StringValue::as_str),
        Some("1")
    );

    let context = extract(
        (0..65)
            .map(|index| format!("key{index}=value"))
            .collect::<Vec<_>>()
            .join(","),
    );
    assert_eq!(context.baggage().len(), 64);
    assert_eq!(
        context.baggage().get("key63").map(StringValue::as_str),
        Some("value")
    );
    assert!(context.baggage().get("key64").is_none());
}

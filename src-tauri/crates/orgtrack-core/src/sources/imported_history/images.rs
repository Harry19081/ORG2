/// Bound retained attachment metadata independently of the provider row size.
/// Full attachment lists (including data URLs) remain in the source turn.
pub(crate) fn bounded_image_refs<'a>(refs: impl IntoIterator<Item = &'a str>) -> Vec<String> {
    let mut remaining = 2_048usize;
    let mut kept: Vec<String> = refs
        .into_iter()
        .filter(|value| !value.starts_with("data:"))
        .filter(|value| {
            let cost = value.len().saturating_add(std::mem::size_of::<String>());
            if cost > remaining {
                return false;
            }
            remaining -= cost;
            true
        })
        .map(str::to_string)
        .collect();
    kept.shrink_to_fit();
    kept
}

#[cfg(test)]
mod image_tests {
    use super::bounded_image_refs;

    #[test]
    fn catalog_never_retains_embedded_bytes_and_bounds_reference_memory() {
        let mut refs = vec![format!("data:image/png;base64,{}", "A".repeat(1024 * 1024))];
        refs.extend((0..100).map(|n| format!("/tmp/{n}-{}.png", "x".repeat(100))));
        let kept = bounded_image_refs(refs.iter().map(String::as_str));
        assert!(!kept.is_empty());
        assert!(kept.iter().all(|r| !r.starts_with("data:")));
        assert!(
            kept.iter()
                .map(|r| r.len() + std::mem::size_of::<String>())
                .sum::<usize>()
                <= 2_048
        );
    }
}

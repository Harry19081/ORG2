#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RedactionReport {
    pub redacted_text: String,
    pub replacements: usize,
}

pub fn redact_secrets(input: &str) -> RedactionReport {
    let patterns = [
        SecretPattern::new("sk-ant-", SecretClass::Token),
        SecretPattern::new("sk-", SecretClass::Token),
        SecretPattern::new("ghp_", SecretClass::Token),
        SecretPattern::new("gho_", SecretClass::Token),
        SecretPattern::new("github_pat_", SecretClass::Token),
        SecretPattern::new("AKIA", SecretClass::FixedLength(20)),
        SecretPattern::new("ASIA", SecretClass::FixedLength(20)),
    ];
    let mut report = RedactionReport {
        redacted_text: input.to_string(),
        replacements: 0,
    };

    for pattern in patterns {
        report = redact_prefixed_tokens(&report.redacted_text, pattern, report.replacements);
    }
    redact_key_assignments(&report.redacted_text, report.replacements)
}

#[derive(Debug, Clone, Copy)]
struct SecretPattern {
    prefix: &'static str,
    class: SecretClass,
}

impl SecretPattern {
    fn new(prefix: &'static str, class: SecretClass) -> Self {
        Self { prefix, class }
    }
}

#[derive(Debug, Clone, Copy)]
enum SecretClass {
    Token,
    FixedLength(usize),
}

fn redact_prefixed_tokens(
    input: &str,
    pattern: SecretPattern,
    replacements: usize,
) -> RedactionReport {
    let mut output = String::with_capacity(input.len());
    let mut replacement_count = replacements;
    let mut index = 0;

    while let Some(relative_start) = input[index..].find(pattern.prefix) {
        let start = index + relative_start;
        output.push_str(&input[index..start]);
        let end = token_end(input, start, pattern);
        output.push_str("[REDACTED_SECRET]");
        replacement_count += 1;
        index = end;
    }

    output.push_str(&input[index..]);
    RedactionReport {
        redacted_text: output,
        replacements: replacement_count,
    }
}

fn token_end(input: &str, start: usize, pattern: SecretPattern) -> usize {
    match pattern.class {
        SecretClass::FixedLength(length) => input.len().min(start + length),
        SecretClass::Token => input[start..]
            .char_indices()
            .find_map(|(offset, character)| {
                if offset == 0 || is_token_character(character) {
                    None
                } else {
                    Some(start + offset)
                }
            })
            .unwrap_or(input.len()),
    }
}

fn is_token_character(character: char) -> bool {
    character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.')
}

fn redact_key_assignments(input: &str, replacements: usize) -> RedactionReport {
    let sensitive_keys = [
        "api_key",
        "apikey",
        "access_token",
        "auth_token",
        "bearer",
        "password",
        "secret_access_key",
        "aws_secret_access_key",
    ];
    let mut replacement_count = replacements;
    let mut lines = Vec::new();

    for line in input.lines() {
        let lower = line.to_ascii_lowercase();
        let has_sensitive_key = sensitive_keys.iter().any(|key| lower.contains(key));
        let separator = line.find('=').or_else(|| line.find(':'));
        if has_sensitive_key {
            if let Some(separator_index) = separator {
                let mut redacted = line[..=separator_index].to_string();
                redacted.push_str(" [REDACTED_SECRET]");
                lines.push(redacted);
                if !line.contains("[REDACTED_SECRET]") {
                    replacement_count += 1;
                }
                continue;
            }
        }
        lines.push(line.to_string());
    }

    let trailing_newline = input.ends_with('\n');
    let mut redacted_text = lines.join("\n");
    if trailing_newline {
        redacted_text.push('\n');
    }

    RedactionReport {
        redacted_text,
        replacements: replacement_count,
    }
}

#[cfg(test)]
mod tests {
    use super::redact_secrets;

    #[test]
    fn redacts_prefixed_tokens_and_key_assignments() {
        let report = redact_secrets(
            "OPENAI_API_KEY=sk-live-secret\nGitHub github_pat_abc123\nAWS AKIA1234567890ABCDEF",
        );

        assert!(report
            .redacted_text
            .contains("OPENAI_API_KEY= [REDACTED_SECRET]"));
        assert!(report.redacted_text.contains("GitHub [REDACTED_SECRET]"));
        assert!(report.redacted_text.contains("AWS [REDACTED_SECRET]"));
        assert_eq!(report.replacements, 3);
    }
}

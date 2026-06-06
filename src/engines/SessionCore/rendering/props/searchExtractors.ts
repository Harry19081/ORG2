/**
 * Search / grep data extractor.
 */
import type {
  ExtractedSearchData,
  UniversalEventProps,
} from "../types/universalProps";

function parseTextSearchResults(textContent: string): Array<{
  file: string;
  line: number;
  content: string;
}> {
  return textContent
    .split("\n")
    .map((line) => line.match(/^(.+?):(\d+):(.*)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      file: match[1],
      line: Number.parseInt(match[2], 10),
      content: match[3],
    }));
}

export function extractSearchData(
  props: UniversalEventProps
): ExtractedSearchData {
  const { args, result } = props;

  if (
    props.rustExtracted?.kind === "search" &&
    props.rustExtracted.results.length > 0
  ) {
    const searchData = props.rustExtracted;
    return {
      query: searchData.query,
      results: searchData.results,
      totalMatches: searchData.totalMatches,
    };
  }

  const query =
    (args?.query as string) ||
    (args?.pattern as string) ||
    (args?.search_query as string) ||
    (args?.regex as string) ||
    (args?.search_term as string) ||
    (args?.searchTerm as string) ||
    (args?.text as string) ||
    (args?.input as string) ||
    "";

  const rawResults = result?.matches;
  const resultsArray = Array.isArray(rawResults) ? rawResults : [];

  let results = resultsArray.map((match) => {
    const matchObj = match as Record<string, unknown>;
    return {
      file: (matchObj.file as string) || "",
      line: (matchObj.line as number) || 0,
      content: (matchObj.content as string) || "",
    };
  });

  if (results.length === 0 && typeof result?.content === "string") {
    results = parseTextSearchResults(result.content);
  }

  let totalMatches = (result?.total as number) || results.length;
  if (totalMatches === 0 && typeof result?.content === "string") {
    const countMatch = (result.content as string).match(
      /(?:Found\s+)?(\d+)\s+match/i
    );
    if (countMatch) {
      totalMatches = parseInt(countMatch[1], 10);
    }
  }

  return { query, results, totalMatches };
}

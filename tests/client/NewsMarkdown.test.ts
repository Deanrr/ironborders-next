import { normalizeNewsMarkdown } from "../../src/client/NewsMarkdown";

describe("normalizeNewsMarkdown", () => {
  it("converts upstream pull request URLs to non-link references", () => {
    const input =
      "Fix attack logic in https://github.com/openfrontio/OpenFrontIO/pull/1234";

    const result = normalizeNewsMarkdown(input);

    expect(result).toBe("Fix attack logic in #1234");
  });

  it("converts upstream compare URLs to non-link references", () => {
    const input =
      "Full Changelog: https://github.com/openfrontio/OpenFrontIO/compare/v1.0.0...v1.1.0";

    const result = normalizeNewsMarkdown(input);

    expect(result).toBe("Full Changelog: v1.0.0...v1.1.0");
  });

  it("keeps contributor mentions as plain text", () => {
    const input = "- Feature by @evanpelle in release notes";

    const result = normalizeNewsMarkdown(input);

    expect(result).toBe(input);
  });

  it("removes destinations from existing external markdown links", () => {
    const input = "Credit [@evanpelle](https://github.com/evanpelle)";

    const result = normalizeNewsMarkdown(input);

    expect(result).toBe("Credit @evanpelle");
  });

  it("does not convert email addresses", () => {
    const input = "Contact support@openfront.io for help";

    const result = normalizeNewsMarkdown(input);

    expect(result).toBe(input);
  });
});

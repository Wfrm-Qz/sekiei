import { describe, expect, it } from "vitest";

import { normalizeRule } from "../../../scripts/check-rulesets.mjs";

describe("normalizeRule", () => {
  it("treats GitHub API default empty required_reviewers as omitted", () => {
    const localRule = normalizeRule({
      type: "pull_request",
      parameters: {
        required_approving_review_count: 1,
        dismiss_stale_reviews_on_push: true,
        require_code_owner_review: true,
        require_last_push_approval: true,
        required_review_thread_resolution: true,
        allowed_merge_methods: ["squash", "merge", "rebase"],
      },
    });
    const remoteRule = normalizeRule({
      type: "pull_request",
      parameters: {
        required_approving_review_count: 1,
        dismiss_stale_reviews_on_push: true,
        required_reviewers: [],
        require_code_owner_review: true,
        require_last_push_approval: true,
        required_review_thread_resolution: true,
        allowed_merge_methods: ["merge", "rebase", "squash"],
      },
    });

    expect(remoteRule).toEqual(localRule);
  });

  it("keeps non-empty required_reviewers for drift detection", () => {
    const normalized = normalizeRule({
      type: "pull_request",
      parameters: {
        required_reviewers: [
          {
            repository_role_name: "maintain",
            reviewer_id: 2,
            reviewer_type: "RepositoryRole",
          },
        ],
      },
    });

    expect(normalized).toEqual({
      type: "pull_request",
      parameters: {
        required_reviewers: [
          {
            repository_role_name: "maintain",
            reviewer_id: 2,
            reviewer_type: "RepositoryRole",
          },
        ],
      },
    });
  });
});

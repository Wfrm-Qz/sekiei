# Repository Policy

この文書は、Sekiei の branch 運用と GitHub 側で設定したい保護ルールのメモです。

## Branch Roles

- `master`
  - 公開用の安定 branch
  - 通常の作業 branch から直接 push しない
  - 基本は `develop` からの pull request で更新する
- `develop`
  - 統合用 branch
  - `issue/*` branch からの pull request を受ける
- `issue/*`
  - 個別作業 branch
  - 原則自由に使う

## Local Preparation In This Repository

- `.githooks/pre-push`
  - `master` と `develop` への直接 push を block
  - `master` と `develop` の削除 push を block
  - `master` と `develop` への non-fast-forward push を block
  - それ以外の branch push では `npm run public:check` を実行
- `.github/workflows/ci.yml`
  - pull request / push ごとに `npm run public:check` を走らせる
- `.github/CODEOWNERS`
  - owner を `@Wfrm-Qz` として review 導線を揃える
- `.github/pull_request_template.md`
  - `issue/* -> develop` と `develop -> master` の flow を PR 作成時に見えるようにする

## Bootstrap Note

この remote は現時点では空なので、最初の `master` / `develop` 作成だけは通常運用と分けて考える必要があります。

ローカル hook は protected branch への直接 push を止めますが、初回 branch 作成だけは次で一時的に通せます。

```powershell
$env:SEKIEI_ALLOW_PROTECTED_BOOTSTRAP='1'
git push -u origin master
git push -u origin develop
Remove-Item Env:SEKIEI_ALLOW_PROTECTED_BOOTSTRAP
```

この bypass は bootstrap 用です。通常運用では使わない想定です。

## GitHub Rules To Configure

### `master`

- direct push 禁止
- pull request 必須
- CI 成功必須
- 所有者以外は review 必須
- `develop -> master` の merge は所有者のみ
- 所有者は PR 上で review / CI failure を bypass して merge 可能
- force push 禁止
- branch 削除禁止

### `develop`

- direct push 禁止
- pull request 必須
- CI 成功必須
- 所有者以外は review 必須
- 所有者は PR 上で review / CI failure を bypass して merge 可能
- force push 禁止
- branch 削除禁止

### `issue/*`

- 原則自由

## Suggested GitHub Setup

GitHub 側では、少なくとも次を branch protection または ruleset で有効にします。

- Require a pull request before merging
- Require status checks to pass before merging
- Require approvals
- Require review from Code Owners
- Do not allow bypassing the above except owner
- Restrict force pushes
- Restrict deletions

`master` については、必要なら `develop` 以外からの merge を owner review / release flow でさらに絞る運用にします。

# Contributing

## Changes go through pull requests

`master` accepts no direct pushes. Every change is a pull request that passes the `test` and `pr-title`
checks and is merged as a **squash commit**.

## The pull request title is a Conventional Commit

The squash commit takes the pull request title as its message, and the version and the changelog are derived
from these messages. The title therefore follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[(scope)][!]: <description>
```

| Type | Meaning | Version |
|---|---|---|
| `feat` | new feature | minor |
| `fix` | bug fix | patch |
| `feat!`, `fix!` (or `BREAKING CHANGE:` in the body) | incompatible change | major |
| `build`, `chore`, `ci`, `docs`, `perf`, `refactor`, `revert`, `style`, `test` | everything else | none |

Refer to the issue in the description, e.g. `Closes #12`.

## Releases

[release-please](https://github.com/googleapis/release-please) keeps a release pull request open that raises the
version in `package.json` and `bower.json` and updates `CHANGELOG.md`. Merging it creates the tag and the GitHub
release, and the workflow publishes the version to npm with provenance.

If a change touches `src/dom-to-image.js`, rebuild `dist/dom-to-image.min.js` with `grunt uglify` and commit it;
the `test` check fails otherwise.

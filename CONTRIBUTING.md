# Contributing

## Changes go through pull requests

`main` accepts no direct pushes. Every change is a pull request that passes the `test` and `pr-title`
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

## One pull request per issue

The release notes get one entry per squash commit, taken from the pull request title. So that every change
appears there with its issue, a pull request solves **one** issue and names it in the title; the description
closes it:

```
fix(fonts): retry a font that failed to load (#15)

Closes #15
```

**Exception — several changes in one pull request:** add each further change as a Conventional Commit line at the
**very end** of the description. release-please turns every such line into an entry of its own
([how it works](https://github.com/googleapis/release-please#what-if-my-pr-contains-multiple-fixes-or-features)):

```
fix(fonts): retry a font that failed to load (#15)

Closes #15, closes #16

fix(images): keep the placeholder for a failed image (#16)
```

A line that does not stand at the end is silently ignored, and the `pr-title` check verifies only the title. The
whole description becomes the commit message, so it should contain no other line that looks like a Conventional
Commit.

## Running the tests

`./node_modules/.bin/karma start karma.ci.conf.js` runs the suite once, as the `test` check does.

Safari is not covered by a check: on the macOS runners of GitHub its canvas does not work (`getImageData()` throws,
`toDataURL()` returns `data:,`). Before a release, run `./test-safari.sh` on a Mac instead. Safari has no headless
mode, so it opens a tab in the background.

## Releases

[release-please](https://github.com/googleapis/release-please) keeps a release pull request open that raises the
version in `package.json` and `bower.json` and updates `CHANGELOG.md`. Merging it creates the tag and the GitHub
release, and the workflow publishes the version to npm with provenance.

If a change touches `src/dom-to-image.js`, rebuild `dist/dom-to-image.min.js` with `grunt uglify` and commit it;
the `test` check fails otherwise.

# Contributing

## Changes go through pull requests

`main` accepts no direct pushes. Every change is a pull request that passes the `test`, `pr-title` and
`dependency-review` checks and is merged as a **squash commit**. `dependency-review` fails when the pull request adds
or raises a dependency with a known vulnerability of severity high or above.

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

`npm ci` installs the development dependencies in the versions of `package-lock.json`, and
`npx playwright install chromium firefox webkit` the browsers. Then `npm test` runs the suite once in headless
Chromium, Firefox and WebKit, as the `test` check does; `BROWSERS=webkit npm test` limits it to some of them, and
`npm test -- --watch` runs it again on every change.

WebKit is not Safari. `npm run test:safari` drives Safari on a Mac through `safaridriver`; Safari has to allow
remote automation once (Settings > Advanced > "Show features for web developers", then Developer > "Allow remote
automation"). The run is suspended for now, since `safaridriver` cannot connect to Safari 27; `test-safari.sh`
explains why, and `SAFARI_WEBDRIVER=1 npm run test:safari` tries it anyway.

## Releases

[release-please](https://github.com/googleapis/release-please) keeps a release pull request open that raises the
version in `package.json` and updates `CHANGELOG.md`. Merging it creates the tag and the GitHub
release, and the workflow publishes the version to npm with provenance.

If a change touches `src/dom-to-image.js`, rebuild `dist/dom-to-image.min.js` with `grunt uglify` and commit it;
the `test` check fails otherwise.

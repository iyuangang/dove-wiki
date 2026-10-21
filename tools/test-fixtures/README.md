# Calculator regression inputs

`calculator-2.0.9.3.json` is an immutable subset of the reviewed snapshot from
Wiki commit `1f8dc1c9c0dafe7d1eea23b198efcc9951fa2e94`. Its provenance records
the game commit and the SHA-256 of the complete original snapshot.

The six towers, seventeen support effects, and technology trees 1 and 4 keep
the original extracted values and review states. Hero/enemy lists are empty
because these formula tests do not use them. This file is mocked only by the
two formula test suites; it is never loaded by the production site.

Do not turn current pending reviews into valid reviews to satisfy these tests.
Current snapshot validity, assets, and expired-review calculation behavior are
checked independently. A newly reviewed formula needs its own versioned fixture
and expectations; do not silently overwrite this baseline during game sync.

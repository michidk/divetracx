# Subsurface test logbooks

These files are unmodified test dive logs from the Subsurface project
(<https://github.com/subsurface/subsurface>, directory `dives/`, commit
`cc669522be5ec667a73f620d23f7f50268dd91be`). Subsurface is licensed under the
GNU General Public License version 2; the files are redistributed here under
that license solely as parser test input. They contain no personal data beyond
the first names the Subsurface developers placed in their own test files.

| File | Format | Exercises |
| --- | --- | --- |
| `test1.xml` | legacy `<dives>` v1 | Minimal dive, `<location>` text, notes |
| `test7.xml` | v1 | Two cylinders, legacy `gaschange value='50'` event, temperatures |
| `test13.xml` | v1 | Three cylinders, gas changes back and forth, samples with elided `temp` |
| `test20.xml` | v1 | Trimix cylinders, `start='200 bar'` without decimals |
| `test23.xml` | v1 | Trips, `tripflag='NOTRIP'`, unpadded `time='6:00:00'` |
| `test26.xml` | v1 | Trip, `<divecomputer>` wrapper, salinity, `ndl` samples |
| `test30.xml` | `<divelog>` v2 | Typed `gaschange`/`heading`/`bookmark` events, manual dive computer |
| `test50.xml` | v2 | `<location gps=…>` inside dives, duplicate site names, unpadded dates |
| `tank_pressure.xml` | v2 | Nameless GPS-only `<location>`, negative coordinates |
| `TwoTimesTwo.ssrf` | v2 | `.ssrf` extension, four dives sharing site names |
| `test42.xml` | v3 | CCR dive with rating, visibility, tags, buddy, divemaster, suit, weights, 2 485 samples |
| `test47c.xml` | v3 | Dives without `number=`, `<divesites>` references |
| `test48.xml` | v3 | Absolute-minimum file without `<settings>` |
| `test51.xml` | v3 | Planned dive with five cylinders and deco samples |
| `TestAtmPress.xml` | v3 | Trip with `airpressure`, weights, `rbt` samples, salinity, non-ASCII text |
| `test-tank-sensors.xml` | v3 | Multi-sensor `pressure0`/`pressure1` samples, `tanksensormapping` |
| `DL7.xml` | v3 | Dives without duration or depth |

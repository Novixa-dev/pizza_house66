// `server-only` is a build-time guard: importing it from a Client Component
// is a compile error. It has no runtime behaviour, and it isn't resolvable
// outside Next's bundler, so the test runner aliases it here.
//
// This does not weaken the guard — Next still enforces it at build time, and
// the build is part of `npm run verify`.
export {};

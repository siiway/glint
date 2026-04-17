Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
bun install
bun run docs:build

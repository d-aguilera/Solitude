#!/bin/bash -e
npm run load:server -- --latency --clients 8 --duration 30 --input-hz 8 --url https://solitude.fly.dev > load-test-fly-gru.jsonl

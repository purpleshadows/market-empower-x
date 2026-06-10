#!/usr/bin/env node
'use strict'

const execSync = require('child_process').execSync

function getCommitRef() {
  if (process.env.VERCEL_GITHUB_COMMIT_SHA) return process.env.VERCEL_GITHUB_COMMIT_SHA
  if (process.env.COMMIT_REF) return process.env.COMMIT_REF

  try {
    return execSync(`git rev-parse HEAD`, {
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

//
// VERCEL_GITHUB_COMMIT_REF & VERCEL_GITHUB_COMMIT_SHA need to be added with empty
// values in Vercel environment variables, making them available to builds.
// https://vercel.com/docs/build-step#system-environment-variables
//
process.stdout.write(
  JSON.stringify(
    {
      version: require('../package.json').version,
      branch:
        process.env.VERCEL_GITHUB_COMMIT_REF || process.env.BRANCH || 'dev',
      commit: getCommitRef()
    },
    null,
    '  '
  )
)

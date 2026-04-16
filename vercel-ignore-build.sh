#!/bin/bash

echo "VERCEL_GIT_COMMIT_REF: $VERCEL_GIT_COMMIT_REF"

if [[ "$VERCEL_GIT_COMMIT_REF" == "gh-pages" ]] ; then
  # Proceed with the build (cancel it by returning 0)
  echo "🛑 Stopping build for gh-pages branch."
  exit 0;
else
  # Proceed with the build (continue)
  echo "✅ Proceeding with build for $VERCEL_GIT_COMMIT_REF."
  exit 1;
fi

# Ocean Node patches (Empower-X)

The production node (`oe-node` on the node box, `192.168.130.2`) runs an image built
locally from the ocean-node **3.2.1** source, with these patches applied to the
TypeScript. Patching the source and building from it means the fixes survive a
container recreate (`docker compose up -d`, `down`/`up`, redeploys). Edits made
inside a running container do not survive a recreate.

| Patch | Problem it fixes |
|---|---|
| `01-url-storage-timeout` | Downloads from slow sources failed with `timeout of 30000ms exceeded` (HTTP 501). Raised to 120 s. |
| `02-c2d-parse-image-tag-digest` | C2D rejected algorithm images given as `repo:tag@sha256:…` ("Cannot find for x86_64"): the tag was left in the repository name. |
| `03-download-no-content-length` | Browsers aborted downloads with `ERR_CONTENT_LENGTH_MISMATCH`: the node declared the size of a *different* upstream fetch. Downloads are now streamed chunked, without a declared length. |
| `04a-event-emitter-address`, `04b-validate-order-by-emitter` | Orders bought through MetaMask delegation (tx sent to the DelegationManager, not the datatoken) failed validation with HTTP 500. Now the `OrderStarted` / `OrderReused` events are accepted only when emitted by the asset's datatoken, as upstream ocean-node 4.2.x does. This also closes a hole where any contract could emit a fake order event. |
| `05-file-metadata-timeout` | File info for slow sources failed silently (reported as 0 bytes) after a fixed 30 s. Now 120 s, overridable with `FILE_METADATA_TIMEOUT_MS` in `.env.node`. |

Background on 03–05: "Ocean Node 3.2.1 — three findings to confirm" (October 2026).

## Apply / redeploy

Copy this folder to the node box, then:

```bash
sudo bash apply-patches.sh /home/dumbnode/soft/ocean/oe-node --deploy
```

The script is idempotent: it skips patches already in place, keeps `.bak-empowerx`
copies, sets the node's `pull_policy` to `missing` (the image exists in no registry),
builds, recreates the node only if the build succeeded, and then checks that every
patch is in the running code. Without `--deploy` it only patches the source.

## Upgrading ocean-node

After `git pull` / checking out a new version in the node source directory, run the
script again. A patch that no longer applies is reported as `DOES NOT APPLY` and
nothing is built; re-port that change by hand. Check first whether upstream already
fixed it: as of 4.2.2, upstream has its own fix for 04 but still has the bugs fixed
by 03 and 05.

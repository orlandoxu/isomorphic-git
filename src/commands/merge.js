// @ts-check
import '../typedefs.js'

import { _commit } from '../commands/commit'
import { _currentBranch } from '../commands/currentBranch.js'
import { _findMergeBase } from '../commands/findMergeBase.js'
import { FastForwardError } from '../errors/FastForwardError.js'
import { MergeNotSupportedError } from '../errors/MergeNotSupportedError.js'
import { GitRefManager } from '../managers/GitRefManager.js'
import { abbreviateRef } from '../utils/abbreviateRef.js'
import { mergeTree } from '../utils/mergeTree.js'

// import diff3 from 'node-diff3'
/**
 *
 * @typedef {Object} MergeResult - Returns an object with a schema like this:
 * @property {string} [oid] - The SHA-1 object id that is now at the head of the branch. Absent only if `dryRun` was specified and `mergeCommit` is true.
 * @property {boolean} [alreadyMerged] - True if the branch was already merged so no changes were made
 * @property {boolean} [fastForward] - True if it was a fast-forward merge
 * @property {boolean} [mergeCommit] - True if merge resulted in a merge commit
 * @property {string} [tree] - The SHA-1 object id of the tree resulting from a merge commit
 *
 */

/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {object} args.cache
 * @param {string} args.gitdir
 * @param {string} [args.ours]
 * @param {string} args.theirs
 * @param {boolean} args.fastForwardOnly
 * @param {boolean} args.dryRun
 * @param {boolean} args.noUpdateBranch
 * @param {string} [args.message]
 * @param {Object} args.author
 * @param {string} args.author.name
 * @param {string} args.author.email
 * @param {number} args.author.timestamp
 * @param {number} args.author.timezoneOffset
 * @param {Object} args.committer
 * @param {string} args.committer.name
 * @param {string} args.committer.email
 * @param {number} args.committer.timestamp
 * @param {number} args.committer.timezoneOffset
 * @param {string} [args.signingKey]
 *
 * @returns {Promise<MergeResult>} Resolves to a description of the merge operation
 * @see MergeResult
 *
 * @example
 * let m = await git.merge({ dir: '$input((/))', ours: '$input((master))', theirs: '$input((remotes/origin/master))' })
 * console.log(m)
 *
 */
export async function _merge({
  fs,
  cache,
  gitdir,
  ours,
  theirs,
  fastForwardOnly = false,
  dryRun = false,
  noUpdateBranch = false,
  message,
  author,
  committer,
  signingKey,
}) {
  if (ours === undefined) {
    ours = await _currentBranch({ fs, gitdir, fullname: true })
  }
  ours = await GitRefManager.expand({
    fs,
    gitdir,
    ref: ours,
  })
  theirs = await GitRefManager.expand({
    fs,
    gitdir,
    ref: theirs,
  })
  const ourOid = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: ours,
  })
  const theirOid = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: theirs,
  })
  // find most recent common ancestor of ref a and ref b
  const baseOids = await _findMergeBase({
    fs,
    gitdir,
    oids: [ourOid, theirOid],
  })
  if (baseOids.length !== 1) {
    throw new MergeNotSupportedError()
  }
  const baseOid = baseOids[0]
  // case 1 无分支 fast-forward case
  if (baseOid === theirOid) {
    return {
      oid: ourOid,
      alreadyMerged: true,
    }
  }
  // case 2 无分支 fast-forward case
  if (baseOid === ourOid) {
    if (!dryRun && !noUpdateBranch) {
      await GitRefManager.writeRef({fs, gitdir, ref: ours, value: theirOid})
    }
    return {
      oid: theirOid,
      fastForward: true,
    }
  }

  // case 3 需要合并分支
  // if (fastForwardOnly) {
  //   throw new FastForwardError()
  // }

  const tree = await mergeTree({
    fs,
    gitdir,
    ourOid,
    theirOid,
    baseOid,
    ourName: ours,
    baseName: 'base',
    theirName: theirs,
    dryRun,
  })

  // TODO：这里可以考虑精简合并的注释
  if (!message) {
    message = `Merge branch '${abbreviateRef(theirs)}' into ${abbreviateRef(
      ours
    )}`
  }

  // TODO: 这里有点难受，他merge了之后会自动commit一次～～
  // 暂时不知道是否对我们的应用场景有影响
  const oid = await _commit({
    fs,
    cache,
    gitdir,
    message,
    ref: ours,
    tree,
    parent: [ourOid, theirOid],
    author,
    committer,
    signingKey,
    dryRun,
    noUpdateBranch,
  })
  return {
    oid,
    tree,
    mergeCommit: true,
  }
}

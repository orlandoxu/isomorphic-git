// @ts-check
import '../typedefs.js'

import { TREE } from '../commands/TREE.js'
import { _walk } from '../commands/walk.js'
import { MergeNotSupportedError } from '../errors/MergeNotSupportedError.js'
import { GitTree } from '../models/GitTree.js'
import { _writeObject as writeObject } from '../storage/writeObject.js'

import { basename } from './basename.js'
import { join } from './join.js'
import { mergeFile } from './mergeFile.js'
import { mergeNoteMeta, mergeFolder, mergeNote } from './mergeNoteMeta.js'

/**
 * 只有两边都有提交的时候，才会走到mergeTree
 * 否则的话，就走fast-forward了
 *
 * @param {Object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ourOid - The SHA-1 object id of our tree
 * @param {string} args.baseOid - The SHA-1 object id of the base tree
 * @param {string} args.theirOid - The SHA-1 object id of their tree
 * @param {string} [args.ourName='ours'] - The name to use in conflicted files for our hunks
 * @param {string} [args.baseName='base'] - The name to use in conflicted files (in diff3 format) for the base hunks
 * @param {string} [args.theirName='theirs'] - The name to use in conflicted files for their hunks
 * @param {boolean} [args.dryRun=false]
 *
 * @returns {Promise<string>} - The SHA-1 object id of the merged tree
 *
 */
export async function mergeTree({
  fs,
  dir,
  gitdir = join(dir, '.git'),
  ourOid,
  baseOid,
  theirOid,
  ourName = 'ours',
  baseName = 'base',
  theirName = 'theirs',
  dryRun = false,
}) {
  const ourTree = TREE({ ref: ourOid })
  const baseTree = TREE({ ref: baseOid })
  const theirTree = TREE({ ref: theirOid })

  const results = await _walk({
    fs,
    dir,
    gitdir,
    trees: [ourTree, baseTree, theirTree],
    map: async function(filepath, [ours, base, theirs]) {
      const path = basename(filepath)
      // What we did, what they did
      const ourChange = await modified(ours, base)
      const theirChange = await modified(theirs, base)
      switch (`${ourChange}-${theirChange}`) {
        case 'false-false': {     // 双方都未改动
          return {
            mode: await base.mode(),
            path,
            oid: await base.oid(),
            type: await base.type(),
          }
        }
        case 'false-true': {      // theirs改变了
          return theirs
            ? {
                mode: await theirs.mode(),
                path,
                oid: await theirs.oid(),
                type: await theirs.type(),
              }
            : undefined
        }
        case 'true-false': {      // theirs改变了
          return ours
            ? {
                mode: await ours.mode(),
                path,
                oid: await ours.oid(),
                type: await ours.type(),
              }
            : undefined
        }
        case 'true-true': {

          // 这里是文本冲突
          // 暂时没有想到我们的应用中哪里会设计到tree冲突
          if ( ours && base && theirs &&
            (await ours.type()) === 'blob' &&
            (await base.type()) === 'blob' &&
            (await theirs.type()) === 'blob'
          ) {
            return mergeBlobs({
              fs,
              gitdir,
              path,
              filepath,
              ours,
              base,
              theirs,
              ourName,
              baseName,
              theirName,
            })
          }

          // all other types of conflicts fail
          // 不是这里出的错！！
          // 但是有可能tree冲突的时候，还是可能走到这里
          throw new MergeNotSupportedError()
        }
      }
    },
    /**
     * @param {TreeEntry} [parent]
     * @param {Array<TreeEntry>} children
     */
    reduce: async (parent, children) => {
      const entries = children.filter(Boolean) // remove undefineds

      // automatically delete directories if they have been emptied
      if (parent && parent.type === 'tree' && entries.length === 0) return

      if (entries.length > 0) {
        const tree = new GitTree(entries)
        const object = tree.toObject()
        const oid = await writeObject({
          fs,
          gitdir,
          type: 'tree',
          object,
          dryRun,
        })
        parent.oid = oid
      }
      return parent
    },
  })
  return results.oid
}

/**
 *
 * @param {WalkerEntry} entry
 * @param {WalkerEntry} base
 *
 */
async function modified(entry, base) {
  if (!entry && !base) return false
  if (entry && !base) return true
  if (!entry && base) return true
  if ((await entry.type()) === 'tree' && (await base.type()) === 'tree') {
    return false
  }
  if (
    (await entry.type()) === (await base.type()) &&
    (await entry.mode()) === (await base.mode()) &&
    (await entry.oid()) === (await base.oid())
  ) {
    return false
  }
  return true
}

/**
 *
 * @param {Object} args
 * @param {import('../models/FileSystem').FileSystem} args.fs
 * @param {string} args.gitdir
 * @param {string} args.path
 * @param {WalkerEntry} args.ours
 * @param {WalkerEntry} args.base
 * @param {WalkerEntry} args.theirs
 * @param {string} [args.ourName]
 * @param {string} [args.baseName]
 * @param {string} [args.theirName]
 * @param {string} [args.format]
 * @param {number} [args.markerSize]
 * @param {boolean} [args.dryRun = false]
 * @param {string} [args.filepath = '']
 */
async function mergeBlobs({
  fs, gitdir, path, ours, base, theirs,
  ourName, theirName, baseName, format, markerSize,
  dryRun, filepath
}) {
  const type = 'blob'
  // Compute the new mode.
  // Since there are ONLY two valid blob modes ('100755' and '100644') it boils down to this
  const mode = (await base.mode()) === (await ours.mode()) ? await theirs.mode() : await ours.mode()

  // The trivial case: nothing to merge except maybe mode
  if ((await ours.oid()) === (await theirs.oid())) {
    return { mode, path, oid: await ours.oid(), type }
  }

  // if only one side made oid changes, return that side's oid
  if ((await ours.oid()) === (await base.oid())) {
    return { mode, path, oid: await theirs.oid(), type }
  }

  if ((await theirs.oid()) === (await base.oid())) {
    return { mode, path, oid: await ours.oid(), type }
  }

  const mergeOption = {
    ourContent: Buffer.from(await ours.content()).toString('utf8'),
    baseContent: Buffer.from(await base.content()).toString('utf8'),
    theirContent: Buffer.from(await theirs.content()).toString('utf8'),
    ourName, theirName, baseName, format, markerSize, filepath
  }

  /**
   * @type {GitMergeResultItemMeta}
   */
  let mergeResult
  if (/^meta\//.test(filepath)) {               // meta
    mergeResult = mergeNoteMeta(mergeOption)
  } else if (/^folder$/.test(filepath)) {       // folder
    mergeResult = mergeFolder(mergeOption)
  } else if (/^notes\/n/.test(filepath)) {
    mergeResult = mergeNote(mergeOption)
  } else {        // 其他
    mergeResult = mergeFile(mergeOption)
  }

  if (!mergeResult.cleanMerge) {
    // all other types of conflicts fail
    throw new MergeNotSupportedError()
  }

  const oid = await writeObject({
    fs,
    gitdir,
    type: 'blob',
    object: Buffer.from(mergeResult.mergedText, 'utf8'),
    dryRun,
  })

  /**
   * @typedef {{mode: number, path: string, oid: *, type: string, conflict: [string, string]}} GitMergeResultItem
   */

  /**
   * @type {GitMergeResultItem}
   */
  const result = { mode, path, oid, type }
  if (mergeResult.conflict) {
    result.conflict = mergeResult.conflict
  }

  return result
}

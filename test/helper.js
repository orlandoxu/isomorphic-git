'use strict'

const fs = require('fs')
// eslint-disable-next-line no-unused-vars
const path = require('path')

const fse = require('fs-extra')

const http = require('../src/http/node')
const Git = require('../src/index')

// const t = require('../lib/tools')

const innerData = {
  lastPushTime: null,
  lastPullTime: null,
  gitLock: false,
}

exports.getLastPushDate = function() {
  return innerData.lastPushTime
}

exports.getLastPullDate = function() {
  return innerData.lastPullTime
}

/**
 * 删除git库
 * @param localPath   本地路径的绝对路径
 * @returns {Promise<void>}
 */
exports.deleteRepo = async function(localPath) {
  // TODO: 删除库文件
}

/**
 * 克隆git库
 * @param gitPath     库路径
 * @param localPath   本地路径的绝对路径
 * @param username    用户名
 * @param password    密码
 * @returns {Promise<void>}
 */
exports.clone = async function(gitPath, localPath, username, password) {
  const onAuth = url => {
    return {
      username: username,
      password: password,
    }
  }
  const onProgress = event => {}

  const onAuthFailure = e => {
    console.log(e)
  }

  const onAuthSuccess = e => {
    console.log(e)
  }

  let err

  // 只get最进的一次commit
  // const option = { onAuth, fs: fs, http: http, dir: localPath, url: gitPath, onProgress, depth: 1 }
  const option = {
    onAuth,
    fs: fs,
    http: http,
    dir: localPath,
    url: gitPath,
    onProgress,
  }

  await Git.clone(option).catch(e => {
    err = e
    if (e && e.data && e.data.statusCode && e.data.statusCode === 403) {
      fse.remove(localPath) // 一旦服务器拒绝要试图删掉文件夹，否则将出现致命错误
    }
  })

  if (err) {
    return false
  }
  return true
}

/**
 * fetch 必须要先fetch下来，再merge，否则冲突无法解决
 * TODO: 还需要做解决冲突
 * @param  gitPath     库路径
 * @param localPath   本地路径的绝对路径
 * @param username    用户名
 * @param password    密码
 * @returns {Promise<void>}
 */
exports.fetch = async function(gitPath, localPath, username, password) {
  const onAuth = url => {
    return {
      username: username,
      password: password,
    }
  }

  // fastForward 可以少记录，还不用提用户名
  const option = {
    onAuth,
    fs,
    http,
    url: gitPath,
    dir: localPath,
    tags: false,
    ref: 'master',
    singleBranch: true,
    // depth: 1,
  }

  /**
   * @typedef {{headers: {}, fetchHead: string, fetchHeadDescription: string, pruned: string, defaultBranch: string}} FetchResult
   */

  /**
   * @type {FetchResult}
   */
  const result = await Git.fetch(option).catch(err => {
    // err = err
    console.log(err)
  })
  // 文档说成功的时候，才会resolve

  return result
}

/**
 * merge上一步fetch下来的代码
 * @param  gitPath     库路径
 * @param localPath   本地路径的绝对路径
 * @param username    用户名
 * @param password    密码
 * @returns {Promise<void>}
 */
exports.merge = async function(localPath, theirs, ours = 'master') {
  // fastForward 可以少记录，还不用提用户名
  // TODO: 51来了才能继续写了
  // 注意：merge之前必须要先commit！如果没有经过commit，是不可能merge的时候冲突的
  const option = {
    fs,
    dir: localPath,
    theirs,
    author: { name: 'G' },
  }

  /**
   * @typedef {{alreadyMerged: boolean, tree: string, mergeCommit: boolean, oid: string, fastForward: boolean}} MergeResult
   */

  const errFile = []

  /**
   * @type {MergeResult}
   */
  const mr = await Git.merge(option).catch(err => {
    console.log(err)
  })

  const checkoutOption = {
    fs,
    dir: localPath,
    noCheckout: false,
    ref: 'master',
  }

  // CheckoutConflictError: Your local changes to the following files would be overwritten by checkout: readme.txt
  // at _checkout (/Users/xsl/work/noteserver/node_modules/isomorphic-git/index.cjs:5385:13)
  // at async Object.checkout (/Users/xsl/work/noteserver/node_modules/isomorphic-git/index.cjs:5924:12)
  // at async Object.exports.merge (/Users/xsl/work/noteserver/lib/gitJsHelper.js:156:3)
  // at async mergeTest (/Users/xsl/work/noteserver/test/gitJS.js:65:23) {
  //   caller: 'git.checkout',
  //     name: 'CheckoutConflictError',
  //     code: 'CheckoutConflictError',
  //     data: { filepaths: [ 'readme.txt' ] }
  // }

  await Git.checkout(checkoutOption).catch(e => {
    console.log(e)
  })

  return mr
}

/**
 * 更新git仓库
 * TODO: 还需要做解决冲突
 * @param gitPath     库路径
 * @param localPath   本地路径的绝对路径
 * @param username    用户名
 * @param password    密码
 * @returns {Promise<void>}
 */
exports.pull = async function(localPath, username, password) {
  const onAuth = url => {
    return {
      username: username,
      password: password,
    }
  }

  let err = true
  // fastForward 可以少记录，还不用提用户名
  await Git.fastForward({
    onAuth,
    fs,
    http,
    dir: localPath,
    ref: 'master',
    singleBranch: true,
  }).catch(e => {
    err = e
    if (err.name === 'CheckoutConflictError') {
      err = { name: 'coConflict', data: err.data }
    }
  })
  return err
}

/**
 * 获取当前所在的branch (可能返回 undefined)
 * @param localPath
 * @returns {Promise<T>}
 */
exports.getCurrentBranch = async function(localPath) {
  // console.log('Branch Search')
  // const repo = await Git.Repository.open(localPath)
  // const ref = await repo.getCurrentBranch().catch(e => {
  //   // 如果是新库，将报下面的错误
  //   // Error: reference 'refs/heads/master' not found
  //   // console.log(e)
  // })
  //
  // return ref
}

/**
 * 获取仓库的变动状态
 * @param localPath
 * @returns {Promise<{}>}
 */
exports.getChangeStatus = async function(localPathOrRepo) {
  // let repo = localPathOrRepo
  // if (typeof localPathOrRepo === 'string') {
  //   repo = await Git.Repository.open(localPathOrRepo)
  // }
  //
  // const statuses = await repo.getStatus()
  //
  // const r_statuses = {}
  // for (let i = 0; i < statuses.length; i++) {
  //   let type = '';
  //   if (statuses[i].isNew()) {
  //     type = 'NEW'
  //   } else if (statuses[i].isDeleted()) {
  //     type = 'DELETED'
  //   } else if (statuses[i].isModified()) {
  //     type = 'MODIFIED'
  //   } else if (statuses[i].isTypechange()) {
  //     type = 'TYPECHANGE'
  //   } else if (statuses[i].isRenamed()) {
  //     type = 'RENAMED'
  //   } else if (statuses[i].isIgnored()) {
  //     type = 'IGNORED'
  //   } else {
  //     continue
  //   }
  //
  //   r_statuses[type] = r_statuses[type] || []
  //   r_statuses[type].push(statuses[i].path())
  // }
  //
  // // console.log(r_statuses);
  // // console.log(statuses);
  // return r_statuses
}

/**
 * push笔记内容
 * @param gitPath
 * @param localPath
 * @param username
 * @param password
 * @returns {Promise<void>}
 */
exports.push = async function(localPath, username, password) {
  const onAuth = url => {
    return {
      username: username,
      password: password,
    }
  }

  let err = true
  await Git.push({ onAuth, fs, http, dir: localPath, ref: 'master' }).catch(
    e => {
      err = e
      console.log(err)
      if (err.name === 'CheckoutConflictError') {
        err = { name: 'coConflict', data: err.data }
      }
    }
  )
  return err
}

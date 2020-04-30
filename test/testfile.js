'use strict'

// const fs = require('fs')
// const http = require('../src/http/node')
// const git = require('../src/index')

const gitHelper = require('./helper')

const gitPath = 'http://47.240.162.107:10001/git/lG7ovNkvuW481Jbw'
const username = '3OOioYZ7SO34kHmU'
const password = '3its45tmONC0jkAc'
const localPath = '/Users/xsl/tmp/del'

// const onProgress = event => {
//   console.log(event)
// }

async function cloneTest() {
  await gitHelper
    .clone(gitPath, localPath, username, password)
    .then(console.log)
    .catch(err => {
      console.log('err', err)
    })
}

async function fetchTest() {
  const f = await gitHelper.fetch(
    gitPath,
    localPath,
    '3OOioYZ7SO34kHmU',
    '3its45tmONC0jkAc'
  )
  // {
  //   defaultBranch: 'refs/heads/master',
  //   fetchHead: '31caca1dc7abb6eb495bb0ed789483fca7eb443d',
  //   fetchHeadDescription: "branch 'master' of http://3OOioYZ7SO34kHmU:3its45tmONC0jkAc@47.240.162.107:10001/git/lG7ovNkvuW481Jbw",
  //   headers: {
  //     server: 'nginx/1.14.2',
  //       date: 'Wed, 29 Apr 2020 03:59:22 GMT',
  //       'content-type': 'application/x-git-upload-pack-result',
  //       'transfer-encoding': 'chunked',
  //       connection: 'close',
  //       expires: 'Fri, 01 Jan 1980 00:00:00 GMT',
  //       pragma: 'no-cache',
  //       'cache-control': 'no-cache, max-age=0, must-revalidate'
  //   },
  //   packfile: 'objects/pack/pack-0cb012f2a1d27e0af6db7990203dd32d89cbd27a.pack'
  // }

  console.log(f)
}

// {
//   defaultBranch: 'refs/heads/master',
//   fetchHead: '31caca1dc7abb6eb495bb0ed789483fca7eb443d',
//   fetchHeadDescription: "branch 'master' of http://3OOioYZ7SO34kHmU:3its45tmONC0jkAc@47.240.162.107:10001/git/lG7ovNkvuW481Jbw",
//   headers: {
//     server: 'nginx/1.14.2',
//       date: 'Wed, 29 Apr 2020 03:59:22 GMT',
//       'content-type': 'application/x-git-upload-pack-result',
//       'transfer-encoding': 'chunked',
//       connection: 'close',
//       expires: 'Fri, 01 Jan 1980 00:00:00 GMT',
//       pragma: 'no-cache',
//       'cache-control': 'no-cache, max-age=0, must-revalidate'
//   },
//   packfile: 'objects/pack/pack-0cb012f2a1d27e0af6db7990203dd32d89cbd27a.pack'
// }
async function mergeTest() {
  // TODO: 按理说这里应该先add commit吧？？
  const f = await gitHelper.fetch(
    gitPath,
    localPath,
    '3OOioYZ7SO34kHmU',
    '3its45tmONC0jkAc'
  )
  const mergeResult = await gitHelper.merge(localPath, f.fetchHead).catch(err => {
    console.log(err)
  })

  // const checkoutOption = {
  //   fs, dir: localPath, noCheckout: false,
  //   ref: 'master'
  // }

  // await gitHelper.checkout(checkoutOption).catch(e => {
  //   console.log(e)
  // })

  console.log('orlando', mergeResult)
}

// cloneTest()
// fetchTest()
mergeTest()

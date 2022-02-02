const axios = require('axios').default;
const fs = require('fs');
require('dotenv').config()
let {NODE_RPC_URL, INDEXER_RPC_URL, REQUESTS_COUNT, CHUNK_SIZE} = process.env
REQUESTS_COUNT = +REQUESTS_COUNT

const requestsSet = JSON.parse(fs.readFileSync('requests.json'));

const wrapRequest = (param) => {
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_getLogs",
        "params": [param]
    }
}

const splitToChunks = (arr, size = CHUNK_SIZE) => {
    return arr.reduce((acc, _, i) => {
        if (i % size === 0) acc.push(arr.slice(i, i + size))
        return acc
    }, [])
}

const sleep = (timeout) => new Promise(resolve => setTimeout(resolve, timeout))

const runTestSuite = async (rpcUrl, requestsCount = REQUESTS_COUNT) => {
    let totalItemsReceived = 0
    let errorsCount = 0
    const timeStart = Date.now()
    const paramsSet = Array(requestsCount).fill(null).map((_, index) => {
        return requestsSet[index % requestsSet.length]
    }).flat()

    const paramsChunks = splitToChunks(paramsSet, CHUNK_SIZE)

    for(let i=0; i < paramsChunks.length; i++) {
        const chunkTimeStart = Date.now()
        const chunk = paramsChunks[i]

        const results = await Promise.all(chunk.map(async (params) => {
            try {
                const {data} = await axios.post(rpcUrl, wrapRequest(params))
                return data.result
            } catch (e) {
                if (errorsCount === 0) {
                    console.error('ERROR on request:', e.message)
                }
                errorsCount += 1
                return []
            }
        })).then(results => results.flat())

        totalItemsReceived += results.length

        if (i < paramsChunks.length - 1) {
            console.log(`Completed ${(i + 1)} chunk(s) of ${paramsChunks.length} (${Date.now() - chunkTimeStart} ms)`)
        }
        await sleep(2000)
    }
    return {
        totalTime: Date.now() - timeStart,
        totalItemsReceived,
        errorsCount
    }
}

const runTests = async () => {
    const rpcUrls = [NODE_RPC_URL, INDEXER_RPC_URL].filter((_) => _)
    for(let i=0; i < rpcUrls.length; i++) {
        const url = rpcUrls[i]
        console.log(`Starting tests using RPC ${url} (${i + 1} of ${rpcUrls.length})`)
        const result = await runTestSuite(url, REQUESTS_COUNT)
        console.log(`
            Multiple concurrent requests (requests count = ${REQUESTS_COUNT}) test completed.
            Total time spent: ${result.totalTime} ms
            Total results received: ${result.totalItemsReceived}
            Errors count: ${result.errorsCount}
        `)
    }
}

runTests()

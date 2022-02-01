const axios = require('axios').default;
require('dotenv').config()
let {NODE_RPC_URL, INDEXER_RPC_URL, REQUESTS_COUNT, CHUNK_SIZE} = process.env
REQUESTS_COUNT = +REQUESTS_COUNT

const requestsSet = [{
    "address": "0xcf664087a5bb0237a0bad6742852ec6c8d69a27a",
    "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"], // Transfer
    "fromBlock": "0x155E758", // 22407000
    "toBlock": "0x155E94C" // 22407500
}, {
    "address": "0xcf664087a5bb0237a0bad6742852ec6c8d69a27a",
    "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
    "fromBlock": "0x155E94C", // 22407500
    "toBlock": "0x155EB40" // 22408000
}, {
    "blockhash": "0xa4d855c788d9514a5ce5190cb6a4964c1d6a1bcd4b3a4ad3108999e8bbc47add" // #22407000
}, {
    "fromBlock": "0x155E7D3", // 22407123
    "toBlock": "0x155E7D3",
}, {
    "topics": ["0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"], // Approval
    "fromBlock": "0x155E758",
    "toBlock": "0x155E94C"
}, {
    "topics": ["0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"],
    "fromBlock": "0x155E758",
    "toBlock": "0x155E94C"
}, {
    "topics": ["0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"],
    "fromBlock": "0x22439778", // big block 22439778 with 1700 txs
    "toBlock": "0x1566762"
}]

/*
* , {
    "address": "0x72cb10c6bfa5624dd07ef608027e366bd690048f",
    "fromBlock": "0x1566C28", // 22441000
    "toBlock": "0x1567010" // 22442000
}*/

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

const WebSocket = require("ws")
const readline = require("readline")
const cbor = require("cbor")
const argv = require("yargs")
    .option("server", {
        alias: "S"
    })
    .default("server", "wss://osmarks.tk/skynet2/")
    .option("send", {
        alias: "s"
    })
    .array("send")
    .option("receive", {
        alias: "r"
    })
    .array("receive")
    .option("json", {
        alias: "J"
    })
    .boolean("json")
    .describe("server", "Skynet server to use")
    .describe("send", "Send on these channels")
    .describe("receive", "Receive on these channels")
    .describe("json", "Interpret stdin as JSON and send JSON to stdout")
    .check(argv => (argv.receive || argv.send) ? true : "Supply at least one channel to send/receive on")
    .parse()

const ws = new WebSocket(argv.server + "/connect")
const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity
})

ws.sendCBOR = message => ws.send(cbor.encode(message))

ws.on("message", data => {
    const message = cbor.decode(data)
    const type = message[0]
    if (type === "error") {
        console.error(message[1] + " - " + message[2])
        process.exit(1)
    } else if (type === "message") {
        const { channel, message: msg } = message[1]
        if (argv.json) {
            process.stdout.write(JSON.stringify([channel, msg]))
            process.stdout.write("\n")
        } else {
            if (msg instanceof Buffer || typeof msg === "string") {
                process.stdout.write(msg)
                process.stdout.write("\n")
            }
        }
    }
})

if (argv.receive) {
    ws.on("open", () => argv.receive.forEach(channel =>
        ws.sendCBOR([
            "open",
            channel
        ]))
    )
    ws.on("close", () => rl.close)
}

if (argv.send) {
    ws.on("open", () => {
        rl.on("line", line => {
            const message = argv.json ? JSON.parse(line) : line
            argv.send.forEach(channel => 
                ws.sendCBOR([
                    "message",
                    {
                        message,
                        channel
                    }
                ]))
        })
    })
    rl.on("close", () => ws.close())
}
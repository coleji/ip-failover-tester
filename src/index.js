const ini = require('ini');
const fs = require('fs');
const exec = require('child_process').exec;

// Hosts: e.g. "alias1,ip1,port1_alias2,ip2,port2"
const {hosts: hostString, timeoutSeconds, runIntervalSeconds, assertEveryHours} = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));

const hostPairs = hostString.split("_");

const hosts = hostPairs.map(hostPair => {
	const [alias, ip, port] = hostPair.split(",");
	return {alias, ip, port};
});

console.log("configured hosts: ", hosts)

var lastOutput = null;
var assertAfter = null;

// use netcat to see if the ip is listening at that port.  Return a promise that resolves true if yes, resolves false if no, rejects if any error
function getOutput(ip, port) {
	return new Promise((resolve, reject) => {
		exec(`nc -zw ${timeoutSeconds} ${ip} ${port}; echo $?`, function(error, stdout, stderr) {
			var result = stdout.trim()
			if (result == "0") resolve(true);
			else if (result == "1") resolve(false);
			else reject();
		})
	});
}

/**
 * 
 * @param {*} output Array of booleans that lines up with the array of hosts
 * @returns A single string to output to the log (and test for changes)
 */
function stringifyOutput(output) {
	return output.map((e, i) => {
		const host = hosts[i];
		return `${host.alias} (${host.ip}:${host.port}): ${e ? "UP" : "DOWN"}`
	}).join("; ")
}

// Kick the next assert time forward
function bumpAssertTime() {
	assertAfter = (new Date()).getTime() + (1000 * 60 * 60 * assertEveryHours);
}

function loop() {
	// fire off netcat calls to all defined ips/ports
	Promise.all(hosts.map(h => getOutput(h.ip, h.port))).then(
		(results) => {
			const date = new Date();
			const resultsString = stringifyOutput(results);
			if (lastOutput == null) {
				// first boot
				console.log(`[${date}] First scan: ${resultsString}`);
				bumpAssertTime();
			} else if (lastOutput != resultsString) {
				console.log(`[${date}] #### Change detected ####: ${resultsString}`);
				bumpAssertTime();
			} else if (assertAfter < (new Date()).getTime()) {
				console.log(`[${date}] Repeating state: ${resultsString}`);
				bumpAssertTime();
			}
			// else {
			// 	console.log("no change")
			// }
			lastOutput = resultsString;
		},
		err => console.error("Error: ", err)
	).then(() => {
		setTimeout(loop, 1000 * Number(runIntervalSeconds));
	});
}

loop();
const ini = require('ini');
const fs = require('fs');
const exec = require('child_process').exec;

const {hosts: hostString, timeoutSeconds, runIntervalSeconds, assertEveryHours} = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));

const hostPairs = hostString.split("$");

const hosts = hostPairs.map(hostPair => {
	const [alias, ip, port] = hostPair.split(",");
	return {alias, ip, port};
});

console.log("configured hosts: ", hosts)

var lastOutput = null;

var assertAfter = null;

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

function stringifyOutput(output) {
	return output.map((e, i) => {
		const host = hosts[i];
		return `${host.alias} (${host.ip}:${host.port}): ${e ? "UP" : "DOWN"}`
	}).join("; ")
}

function bumpAssertTime() {
	assertAfter = (new Date()).getTime() + (1000 * 20)//(1000 * 60 * 60 * assertEveryHours);
}


function loop() {
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
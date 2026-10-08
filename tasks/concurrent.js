'use strict';
const os = require('os');
const {Transform} = require('stream');
const {StringDecoder} = require('string_decoder');

const subprocesses = [];

// Indent every non-blank line (what indent-string did)
const indentString = (string, count) => string.replace(/^(?!\s*$)/gm, ' '.repeat(count));

// Indent a stream line by line (what pad-stream did): every line, including
// blank ones, comes out indented and newline-terminated
const padStream = count => {
	const indent = ' '.repeat(count);
	const decoder = new StringDecoder('utf8');
	let rest = '';
	return new Transform({
		transform(chunk, encoding, callback) {
			const lines = (rest + decoder.write(chunk)).split(/\r?\n/);
			rest = lines.pop();
			callback(null, lines.map(line => indent + line + '\n').join(''));
		},
		flush(callback) {
			rest += decoder.end();
			callback(null, rest ? indent + rest + '\n' : '');
		}
	});
};

// Run `iteratee` over `items` with at most `limit` in flight; stop starting new
// ones after the first error (what async.eachLimit did)
const eachLimit = (items, limit, iteratee, callback) => {
	let index = 0;
	let running = 0;
	let finished = false;

	const launch = () => {
		while (!finished && running < limit && index < items.length) {
			const item = items[index++];
			let called = false;
			running++;
			iteratee(item, error => {
				if (called) {
					return;
				}

				called = true;
				running--;
				if (finished) {
					return;
				}

				if (error) {
					finished = true;
					callback(error);
				} else if (index === items.length && running === 0) {
					finished = true;
					callback();
				} else {
					launch();
				}
			});
		}
	};

	if (items.length === 0) {
		callback();
	} else {
		launch();
	}
};

const toArray = value => {
	if (value === null || value === undefined) {
		return [];
	}

	return Array.isArray(value) ? value : [value];
};

module.exports = grunt => {
	grunt.registerMultiTask('concurrent', 'Run grunt tasks concurrently', function () {
		const done = this.async();

		const options = this.options({
			limit: Math.max((os.cpus().length || 1) * 2, 2),
			indent: true
		});

		const tasks = toArray(this.data.tasks || this.data);
		const flags = grunt.option.flags();

		if (
			!flags.includes('--no-color') &&
			!flags.includes('--no-colors') &&
			!flags.includes('--color=false')
		) {
			// Append the flag so that support-colors won't return false
			// See issue #70 for details
			flags.push('--color');
		}

		if (options.limit < tasks.length) {
			grunt.log.oklns(
				'Warning: There are more tasks than your concurrency limit. After this limit is reached no further tasks will be run until the current tasks are completed. You can adjust the limit in the concurrent task options'
			);
		}

		eachLimit(tasks, options.limit, (task, next) => {
			const subprocess = grunt.util.spawn({
				grunt: true,
				args: toArray(task).concat(flags),
				opts: {
					stdio: [
						'ignore',
						'pipe',
						'pipe'
					]
				}
			}, (error, result) => {
				if (!options.logConcurrentOutput) {
					let output = result.stdout + result.stderr;
					if (options.indent) {
						output = indentString(output, 4);
					}

					grunt.log.writeln(`\n${output}`);
				}

				next(error);
			});

			if (options.logConcurrentOutput) {
				let subStdout = subprocess.stdout;
				let subStderr = subprocess.stderr;
				if (options.indent) {
					subStdout = subStdout.pipe(padStream(4));
					subStderr = subStderr.pipe(padStream(4));
				}

				subStdout.pipe(process.stdout);
				subStderr.pipe(process.stderr);
			}

			subprocesses.push(subprocess);
		}, error => {
			if (error) {
				grunt.warn(error);
			}

			done();
		});
	});
};

function cleanup() {
	for (const subprocess of subprocesses) {
		subprocess.kill('SIGKILL');
	}
}

// Make sure all subprocesses are killed when grunt exits
process.on('exit', cleanup);
process.on('SIGINT', () => {
	cleanup();
	process.exit();
});

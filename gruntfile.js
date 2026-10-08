'use strict';

module.exports = grunt => {
	grunt.initConfig({
		concurrent: {
			test: [
				'test1',
				'test2',
				'test3'
			],
			testSequence: [
				'test4', [
					'test5',
					'test6'
				]
			],
			testargs: [
				'testargs1',
				'testargs2'
			],
			log: {
				options: {
					logConcurrentOutput: true
				},
				tasks: [
					'testIndent',
					'testMultiline'
				]
			},
			fail: [
				'test1',
				'testFail'
			],
			limited: {
				options: {
					limit: 1
				},
				tasks: [
					'test2',
					'test3'
				]
			},
			colors: [
				'colorcheck'
			],
			indentTrue: {
				options: {
					indent: true
				},
				tasks: [
					'testIndent'
				]
			},
			indentFalse: {
				options: {
					indent: false
				},
				tasks: [
					'testIndent'
				]
			},
			indentFalseConcurrentOutput: {
				options: {
					logConcurrentOutput: true,
					indent: false
				},
				tasks: [
					'testIndent'
				]
			},
			indentDefault: [
				'testIndent'
			]
		}
	});

	grunt.loadTasks('tasks');

	grunt.registerTask('test1', () => {
		console.log('test1');
		grunt.file.write('test/tmp/1');
	});

	grunt.registerTask('test2', function () {
		const cb = this.async();
		setTimeout(() => {
			console.log('test2');
			grunt.file.write('test/tmp/2');
			cb();
		}, 1000);
	});

	grunt.registerTask('test3', () => {
		console.log('test3');
		grunt.file.write('test/tmp/3');
	});

	grunt.registerTask('test4', () => {
		console.log('test4');
		grunt.file.write('test/tmp/4');
	});

	grunt.registerTask('test5', () => {
		console.log('test5');
		grunt.file.write('test/tmp/5');
		sleep(1000);
	});

	grunt.registerTask('test6', () => {
		console.log('test6');
		grunt.file.write('test/tmp/6');
	});

	grunt.registerTask('testargs1', () => {
		const args = grunt.option.flags().join();
		grunt.file.write('test/tmp/args1', args);
	});

	grunt.registerTask('testargs2', () => {
		const args = grunt.option.flags().join();
		grunt.file.write('test/tmp/args2', args);
	});

	grunt.registerTask('colorcheck', () => {
		// Writes 'true' or 'false' to the file, using the same flag checks
		// supports-color makes
		const flags = grunt.option.flags();
		const supports = flags.includes('--color') && !flags.some(flag => /^--no-colou?rs?$|^--colou?r=false$/.test(flag));
		grunt.file.write('test/tmp/colors', String(supports));
	});

	grunt.registerTask('testMultiline', () => {
		console.log('line one\n\nline three');
	});

	grunt.registerTask('testFail', () => {
		grunt.fail.warn('testFail failed on purpose');
	});

	grunt.registerTask('testIndent', () => {
		console.log('indent test output');
	});

	grunt.registerTask('default', [
		'concurrent:test',
		'concurrent:testSequence'
	]);
};

function sleep(milliseconds) {
	const start = new Date().getTime();
	for (let i = 0; i < 1e7; i++) {
		if ((new Date().getTime() - start) > milliseconds) {
			break;
		}
	}
}

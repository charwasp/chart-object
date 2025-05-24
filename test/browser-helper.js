function test(id, testFunction) {
	const button = document.getElementById(id);
	button.addEventListener('click', async () => {
		let output = document.getElementById(`${id}-output`);
		if (!output) {
			output = document.createElement('div');
			output.id = `${id}-output`;
			button.parentNode.insertBefore(output, button.nextSibling);
		}
		try {
			const result = testFunction();
			if (result instanceof Promise) {
				await result;
			}
			output.textContent = 'Passed';
			output.classList.add('pass');
			output.classList.remove('fail');
		} catch (error) {
			output.textContent = 'Failed: ' + error.message;
			console.error(error);
			output.classList.add('fail');
			output.classList.remove('pass');
		}
	});
}

class Assertion {
	constructor(value) {
		this.value = value;
	}

	toBe(expected) {
		if (this.value !== expected) {
			throw new Error(`Expected ${this.value} to be ${expected}`);
		}
	}

	notToBe(expected) {
		if (this.value === expected) {
			throw new Error(`Expected ${this.value} not to be ${expected}`);
		}
	}

	toBeApproximately(expected, epsilon = 1e-8) {
		if (Math.abs(this.value - expected) > epsilon) {
			throw new Error(`Expected ${this.value} to be approximately ${expected}`);
		}
	}
}

function expect(value) {
	return new Assertion(value);
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	try {
		const result = fn();
		if (result instanceof Promise) {
			await result;
		}
		console.error(`Test ${name} passed`);
	} catch (error) {
		console.error(`Test ${name} failed`, error);
	}
}

class Assertion {
	constructor(private value: any) {}

	toBe(expected: any) {
		if (this.value !== expected) {
			throw new Error(`Expected ${this.value} to be ${expected}`);
		}
	}

	notToBe(expected: any) {
		if (this.value === expected) {
			throw new Error(`Expected ${this.value} not to be ${expected}`);
		}
	}

	toBeApproximately(expected: number, epsilon = 1e-8) {
		if (Math.abs(this.value - expected) > epsilon) {
			throw new Error(`Expected ${this.value} to be approximately ${expected}`);
		}
	}
}

function expect(value: any) {
	return new Assertion(value);
}

export { test, expect };

(function (exports) {
  'use strict';

  /**
   *
   * This class offers the possibility to calculate fractions.
   * You can pass a fraction in different formats. Either as array, as double, as string or as an integer.
   *
   * Array/Object form
   * [ 0 => <numerator>, 1 => <denominator> ]
   * { n => <numerator>, d => <denominator> }
   *
   * Integer form
   * - Single integer value as BigInt or Number
   *
   * Double form
   * - Single double value as Number
   *
   * String form
   * 123.456 - a simple double
   * 123/456 - a string fraction
   * 123.'456' - a double with repeating decimal places
   * 123.(456) - synonym
   * 123.45'6' - a double with repeating last place
   * 123.45(6) - synonym
   *
   * Example:
   * let f = new Fraction("9.4'31'");
   * f.mul([-4, 3]).div(4.9);
   *
   */

  // Set Identity function to downgrade BigInt to Number if needed
  if (typeof BigInt === 'undefined') BigInt = function (n) { if (isNaN(n)) throw new Error(""); return n; };

  const C_ZERO = BigInt(0);
  const C_ONE = BigInt(1);
  const C_TWO = BigInt(2);
  const C_FIVE = BigInt(5);
  const C_TEN = BigInt(10);

  // Maximum search depth for cyclic rational numbers. 2000 should be more than enough.
  // Example: 1/7 = 0.(142857) has 6 repeating decimal places.
  // If MAX_CYCLE_LEN gets reduced, long cycles will not be detected and toString() only gets the first 10 digits
  const MAX_CYCLE_LEN = 2000;

  // Parsed data to avoid calling "new" all the time
  const P = {
    "s": C_ONE,
    "n": C_ZERO,
    "d": C_ONE
  };

  function assign(n, s) {

    try {
      n = BigInt(n);
    } catch (e) {
      throw InvalidParameter();
    }
    return n * s;
  }

  function trunc(x) {
    return typeof x === 'bigint' ? x : Math.floor(x);
  }

  // Creates a new Fraction internally without the need of the bulky constructor
  function newFraction(n, d) {

    if (d === C_ZERO) {
      throw DivisionByZero();
    }

    const f = Object.create(Fraction.prototype);
    f["s"] = n < C_ZERO ? -C_ONE : C_ONE;

    n = n < C_ZERO ? -n : n;

    const a = gcd(n, d);

    f["n"] = n / a;
    f["d"] = d / a;
    return f;
  }

  function factorize(num) {

    const factors = {};

    let n = num;
    let i = C_TWO;
    let s = C_FIVE - C_ONE;

    while (s <= n) {

      while (n % i === C_ZERO) {
        n /= i;
        factors[i] = (factors[i] || C_ZERO) + C_ONE;
      }
      s += C_ONE + C_TWO * i++;
    }

    if (n !== num) {
      if (n > 1)
        factors[n] = (factors[n] || C_ZERO) + C_ONE;
    } else {
      factors[num] = (factors[num] || C_ZERO) + C_ONE;
    }
    return factors;
  }

  const parse = function (p1, p2) {

    let n = C_ZERO, d = C_ONE, s = C_ONE;

    if (p1 === undefined || p1 === null) ; else if (p2 !== undefined) { // Two arguments

      if (typeof p1 === "bigint") {
        n = p1;
      } else if (isNaN(p1)) {
        throw InvalidParameter();
      } else if (p1 % 1 !== 0) {
        throw NonIntegerParameter();
      } else {
        n = BigInt(p1);
      }

      if (typeof p2 === "bigint") {
        d = p2;
      } else if (isNaN(p2)) {
        throw InvalidParameter();
      } else if (p2 % 1 !== 0) {
        throw NonIntegerParameter();
      } else {
        d = BigInt(p2);
      }

      s = n * d;

    } else if (typeof p1 === "object") {
      if ("d" in p1 && "n" in p1) {
        n = BigInt(p1["n"]);
        d = BigInt(p1["d"]);
        if ("s" in p1)
          n *= BigInt(p1["s"]);
      } else if (0 in p1) {
        n = BigInt(p1[0]);
        if (1 in p1)
          d = BigInt(p1[1]);
      } else if (typeof p1 === "bigint") {
        n = p1;
      } else {
        throw InvalidParameter();
      }
      s = n * d;
    } else if (typeof p1 === "number") {

      if (isNaN(p1)) {
        throw InvalidParameter();
      }

      if (p1 < 0) {
        s = -C_ONE;
        p1 = -p1;
      }

      if (p1 % 1 === 0) {
        n = BigInt(p1);
      } else {

        let z = 1;

        let A = 0, B = 1;
        let C = 1, D = 1;

        let N = 10000000;

        if (p1 >= 1) {
          z = 10 ** Math.floor(1 + Math.log10(p1));
          p1 /= z;
        }

        // Using Farey Sequences

        while (B <= N && D <= N) {
          let M = (A + C) / (B + D);

          if (p1 === M) {
            if (B + D <= N) {
              n = A + C;
              d = B + D;
            } else if (D > B) {
              n = C;
              d = D;
            } else {
              n = A;
              d = B;
            }
            break;

          } else {

            if (p1 > M) {
              A += C;
              B += D;
            } else {
              C += A;
              D += B;
            }

            if (B > N) {
              n = C;
              d = D;
            } else {
              n = A;
              d = B;
            }
          }
        }
        n = BigInt(n) * BigInt(z);
        d = BigInt(d);
      }

    } else if (typeof p1 === "string") {

      let ndx = 0;

      let v = C_ZERO, w = C_ZERO, x = C_ZERO, y = C_ONE, z = C_ONE;

      let match = p1.replace(/_/g, '').match(/\d+|./g);

      if (match === null)
        throw InvalidParameter();

      if (match[ndx] === '-') {// Check for minus sign at the beginning
        s = -C_ONE;
        ndx++;
      } else if (match[ndx] === '+') {// Check for plus sign at the beginning
        ndx++;
      }

      if (match.length === ndx + 1) { // Check if it's just a simple number "1234"
        w = assign(match[ndx++], s);
      } else if (match[ndx + 1] === '.' || match[ndx] === '.') { // Check if it's a decimal number

        if (match[ndx] !== '.') { // Handle 0.5 and .5
          v = assign(match[ndx++], s);
        }
        ndx++;

        // Check for decimal places
        if (ndx + 1 === match.length || match[ndx + 1] === '(' && match[ndx + 3] === ')' || match[ndx + 1] === "'" && match[ndx + 3] === "'") {
          w = assign(match[ndx], s);
          y = C_TEN ** BigInt(match[ndx].length);
          ndx++;
        }

        // Check for repeating places
        if (match[ndx] === '(' && match[ndx + 2] === ')' || match[ndx] === "'" && match[ndx + 2] === "'") {
          x = assign(match[ndx + 1], s);
          z = C_TEN ** BigInt(match[ndx + 1].length) - C_ONE;
          ndx += 3;
        }

      } else if (match[ndx + 1] === '/' || match[ndx + 1] === ':') { // Check for a simple fraction "123/456" or "123:456"
        w = assign(match[ndx], s);
        y = assign(match[ndx + 2], C_ONE);
        ndx += 3;
      } else if (match[ndx + 3] === '/' && match[ndx + 1] === ' ') { // Check for a complex fraction "123 1/2"
        v = assign(match[ndx], s);
        w = assign(match[ndx + 2], s);
        y = assign(match[ndx + 4], C_ONE);
        ndx += 5;
      }

      if (match.length <= ndx) { // Check for more tokens on the stack
        d = y * z;
        s = /* void */
          n = x + d * v + z * w;
      } else {
        throw InvalidParameter();
      }

    } else if (typeof p1 === "bigint") {
      n = p1;
      s = p1;
      d = C_ONE;
    } else {
      throw InvalidParameter();
    }

    if (d === C_ZERO) {
      throw DivisionByZero();
    }

    P["s"] = s < C_ZERO ? -C_ONE : C_ONE;
    P["n"] = n < C_ZERO ? -n : n;
    P["d"] = d < C_ZERO ? -d : d;
  };

  function modpow(b, e, m) {

    let r = C_ONE;
    for (; e > C_ZERO; b = (b * b) % m, e >>= C_ONE) {

      if (e & C_ONE) {
        r = (r * b) % m;
      }
    }
    return r;
  }

  function cycleLen(n, d) {

    for (; d % C_TWO === C_ZERO;
      d /= C_TWO) {
    }

    for (; d % C_FIVE === C_ZERO;
      d /= C_FIVE) {
    }

    if (d === C_ONE) // Catch non-cyclic numbers
      return C_ZERO;

    // If we would like to compute really large numbers quicker, we could make use of Fermat's little theorem:
    // 10^(d-1) % d == 1
    // However, we don't need such large numbers and MAX_CYCLE_LEN should be the capstone,
    // as we want to translate the numbers to strings.

    let rem = C_TEN % d;
    let t = 1;

    for (; rem !== C_ONE; t++) {
      rem = rem * C_TEN % d;

      if (t > MAX_CYCLE_LEN)
        return C_ZERO; // Returning 0 here means that we don't print it as a cyclic number. It's likely that the answer is `d-1`
    }
    return BigInt(t);
  }

  function cycleStart(n, d, len) {

    let rem1 = C_ONE;
    let rem2 = modpow(C_TEN, len, d);

    for (let t = 0; t < 300; t++) { // s < ~log10(Number.MAX_VALUE)
      // Solve 10^s == 10^(s+t) (mod d)

      if (rem1 === rem2)
        return BigInt(t);

      rem1 = rem1 * C_TEN % d;
      rem2 = rem2 * C_TEN % d;
    }
    return 0;
  }

  function gcd(a, b) {

    if (!a)
      return b;
    if (!b)
      return a;

    while (1) {
      a %= b;
      if (!a)
        return b;
      b %= a;
      if (!b)
        return a;
    }
  }

  /**
   * Module constructor
   *
   * @constructor
   * @param {number|Fraction=} a
   * @param {number=} b
   */
  function Fraction(a, b) {

    parse(a, b);

    if (this instanceof Fraction) {
      a = gcd(P["d"], P["n"]); // Abuse a
      this["s"] = P["s"];
      this["n"] = P["n"] / a;
      this["d"] = P["d"] / a;
    } else {
      return newFraction(P['s'] * P['n'], P['d']);
    }
  }

  var DivisionByZero = function () { return new Error("Division by Zero"); };
  var InvalidParameter = function () { return new Error("Invalid argument"); };
  var NonIntegerParameter = function () { return new Error("Parameters must be integer"); };

  Fraction.prototype = {

    "s": C_ONE,
    "n": C_ZERO,
    "d": C_ONE,

    /**
     * Calculates the absolute value
     *
     * Ex: new Fraction(-4).abs() => 4
     **/
    "abs": function () {

      return newFraction(this["n"], this["d"]);
    },

    /**
     * Inverts the sign of the current fraction
     *
     * Ex: new Fraction(-4).neg() => 4
     **/
    "neg": function () {

      return newFraction(-this["s"] * this["n"], this["d"]);
    },

    /**
     * Adds two rational numbers
     *
     * Ex: new Fraction({n: 2, d: 3}).add("14.9") => 467 / 30
     **/
    "add": function (a, b) {

      parse(a, b);
      return newFraction(
        this["s"] * this["n"] * P["d"] + P["s"] * this["d"] * P["n"],
        this["d"] * P["d"]
      );
    },

    /**
     * Subtracts two rational numbers
     *
     * Ex: new Fraction({n: 2, d: 3}).add("14.9") => -427 / 30
     **/
    "sub": function (a, b) {

      parse(a, b);
      return newFraction(
        this["s"] * this["n"] * P["d"] - P["s"] * this["d"] * P["n"],
        this["d"] * P["d"]
      );
    },

    /**
     * Multiplies two rational numbers
     *
     * Ex: new Fraction("-17.(345)").mul(3) => 5776 / 111
     **/
    "mul": function (a, b) {

      parse(a, b);
      return newFraction(
        this["s"] * P["s"] * this["n"] * P["n"],
        this["d"] * P["d"]
      );
    },

    /**
     * Divides two rational numbers
     *
     * Ex: new Fraction("-17.(345)").inverse().div(3)
     **/
    "div": function (a, b) {

      parse(a, b);
      return newFraction(
        this["s"] * P["s"] * this["n"] * P["d"],
        this["d"] * P["n"]
      );
    },

    /**
     * Clones the actual object
     *
     * Ex: new Fraction("-17.(345)").clone()
     **/
    "clone": function () {
      return newFraction(this['s'] * this['n'], this['d']);
    },

    /**
     * Calculates the modulo of two rational numbers - a more precise fmod
     *
     * Ex: new Fraction('4.(3)').mod([7, 8]) => (13/3) % (7/8) = (5/6)
     * Ex: new Fraction(20, 10).mod().equals(0) ? "is Integer"
     **/
    "mod": function (a, b) {

      if (a === undefined) {
        return newFraction(this["s"] * this["n"] % this["d"], C_ONE);
      }

      parse(a, b);
      if (C_ZERO === P["n"] * this["d"]) {
        throw DivisionByZero();
      }

      /**
       * I derived the rational modulo similar to the modulo for integers
       *
       * https://raw.org/book/analysis/rational-numbers/
       *
       *    n1/d1 = (n2/d2) * q + r, where 0 ≤ r < n2/d2
       * => d2 * n1 = n2 * d1 * q + d1 * d2 * r
       * => r = (d2 * n1 - n2 * d1 * q) / (d1 * d2)
       *      = (d2 * n1 - n2 * d1 * floor((d2 * n1) / (n2 * d1))) / (d1 * d2)
       *      = ((d2 * n1) % (n2 * d1)) / (d1 * d2)
       */
      return newFraction(
        this["s"] * (P["d"] * this["n"]) % (P["n"] * this["d"]),
        P["d"] * this["d"]);
    },

    /**
     * Calculates the fractional gcd of two rational numbers
     *
     * Ex: new Fraction(5,8).gcd(3,7) => 1/56
     */
    "gcd": function (a, b) {

      parse(a, b);

      // https://raw.org/book/analysis/rational-numbers/
      // gcd(a / b, c / d) = gcd(a, c) / lcm(b, d)

      return newFraction(gcd(P["n"], this["n"]) * gcd(P["d"], this["d"]), P["d"] * this["d"]);
    },

    /**
     * Calculates the fractional lcm of two rational numbers
     *
     * Ex: new Fraction(5,8).lcm(3,7) => 15
     */
    "lcm": function (a, b) {

      parse(a, b);

      // https://raw.org/book/analysis/rational-numbers/
      // lcm(a / b, c / d) = lcm(a, c) / gcd(b, d)

      if (P["n"] === C_ZERO && this["n"] === C_ZERO) {
        return newFraction(C_ZERO, C_ONE);
      }
      return newFraction(P["n"] * this["n"], gcd(P["n"], this["n"]) * gcd(P["d"], this["d"]));
    },

    /**
     * Gets the inverse of the fraction, means numerator and denominator are exchanged
     *
     * Ex: new Fraction([-3, 4]).inverse() => -4 / 3
     **/
    "inverse": function () {
      return newFraction(this["s"] * this["d"], this["n"]);
    },

    /**
     * Calculates the fraction to some integer exponent
     *
     * Ex: new Fraction(-1,2).pow(-3) => -8
     */
    "pow": function (a, b) {

      parse(a, b);

      // Trivial case when exp is an integer

      if (P['d'] === C_ONE) {

        if (P['s'] < C_ZERO) {
          return newFraction((this['s'] * this["d"]) ** P['n'], this["n"] ** P['n']);
        } else {
          return newFraction((this['s'] * this["n"]) ** P['n'], this["d"] ** P['n']);
        }
      }

      // Negative roots become complex
      //     (-a/b)^(c/d) = x
      // ⇔ (-1)^(c/d) * (a/b)^(c/d) = x
      // ⇔ (cos(pi) + i*sin(pi))^(c/d) * (a/b)^(c/d) = x
      // ⇔ (cos(c*pi/d) + i*sin(c*pi/d)) * (a/b)^(c/d) = x       # DeMoivre's formula
      // From which follows that only for c=0 the root is non-complex
      if (this['s'] < C_ZERO) return null;

      // Now prime factor n and d
      let N = factorize(this['n']);
      let D = factorize(this['d']);

      // Exponentiate and take root for n and d individually
      let n = C_ONE;
      let d = C_ONE;
      for (let k in N) {
        if (k === '1') continue;
        if (k === '0') {
          n = C_ZERO;
          break;
        }
        N[k] *= P['n'];

        if (N[k] % P['d'] === C_ZERO) {
          N[k] /= P['d'];
        } else return null;
        n *= BigInt(k) ** N[k];
      }

      for (let k in D) {
        if (k === '1') continue;
        D[k] *= P['n'];

        if (D[k] % P['d'] === C_ZERO) {
          D[k] /= P['d'];
        } else return null;
        d *= BigInt(k) ** D[k];
      }

      if (P['s'] < C_ZERO) {
        return newFraction(d, n);
      }
      return newFraction(n, d);
    },

    /**
     * Calculates the logarithm of a fraction to a given rational base
     *
     * Ex: new Fraction(27, 8).log(9, 4) => 3/2
     */
    "log": function (a, b) {

      parse(a, b);

      if (this['s'] <= C_ZERO || P['s'] <= C_ZERO) return null;

      const allPrimes = {};

      const baseFactors = factorize(P['n']);
      const T1 = factorize(P['d']);

      const numberFactors = factorize(this['n']);
      const T2 = factorize(this['d']);

      for (const prime in T1) {
        baseFactors[prime] = (baseFactors[prime] || C_ZERO) - T1[prime];
      }
      for (const prime in T2) {
        numberFactors[prime] = (numberFactors[prime] || C_ZERO) - T2[prime];
      }

      for (const prime in baseFactors) {
        if (prime === '1') continue;
        allPrimes[prime] = true;
      }
      for (const prime in numberFactors) {
        if (prime === '1') continue;
        allPrimes[prime] = true;
      }

      let retN = null;
      let retD = null;

      // Iterate over all unique primes to determine if a consistent ratio exists
      for (const prime in allPrimes) {

        const baseExponent = baseFactors[prime] || C_ZERO;
        const numberExponent = numberFactors[prime] || C_ZERO;

        if (baseExponent === C_ZERO) {
          if (numberExponent !== C_ZERO) {
            return null; // Logarithm cannot be expressed as a rational number
          }
          continue; // Skip this prime since both exponents are zero
        }

        // Calculate the ratio of exponents for this prime
        let curN = numberExponent;
        let curD = baseExponent;

        // Simplify the current ratio
        const gcdValue = gcd(curN, curD);
        curN /= gcdValue;
        curD /= gcdValue;

        // Check if this is the first ratio; otherwise, ensure ratios are consistent
        if (retN === null && retD === null) {
          retN = curN;
          retD = curD;
        } else if (curN * retD !== retN * curD) {
          return null; // Ratios do not match, logarithm cannot be rational
        }
      }

      return retN !== null && retD !== null
        ? newFraction(retN, retD)
        : null;
    },

    /**
     * Check if two rational numbers are the same
     *
     * Ex: new Fraction(19.6).equals([98, 5]);
     **/
    "equals": function (a, b) {

      parse(a, b);
      return this["s"] * this["n"] * P["d"] === P["s"] * P["n"] * this["d"];
    },

    /**
     * Check if this rational number is less than another
     *
     * Ex: new Fraction(19.6).lt([98, 5]);
     **/
    "lt": function (a, b) {

      parse(a, b);
      return this["s"] * this["n"] * P["d"] < P["s"] * P["n"] * this["d"];
    },

    /**
     * Check if this rational number is less than or equal another
     *
     * Ex: new Fraction(19.6).lt([98, 5]);
     **/
    "lte": function (a, b) {

      parse(a, b);
      return this["s"] * this["n"] * P["d"] <= P["s"] * P["n"] * this["d"];
    },

    /**
     * Check if this rational number is greater than another
     *
     * Ex: new Fraction(19.6).lt([98, 5]);
     **/
    "gt": function (a, b) {

      parse(a, b);
      return this["s"] * this["n"] * P["d"] > P["s"] * P["n"] * this["d"];
    },

    /**
     * Check if this rational number is greater than or equal another
     *
     * Ex: new Fraction(19.6).lt([98, 5]);
     **/
    "gte": function (a, b) {

      parse(a, b);
      return this["s"] * this["n"] * P["d"] >= P["s"] * P["n"] * this["d"];
    },

    /**
     * Compare two rational numbers
     * < 0 iff this < that
     * > 0 iff this > that
     * = 0 iff this = that
     *
     * Ex: new Fraction(19.6).compare([98, 5]);
     **/
    "compare": function (a, b) {

      parse(a, b);
      let t = this["s"] * this["n"] * P["d"] - P["s"] * P["n"] * this["d"];

      return (C_ZERO < t) - (t < C_ZERO);
    },

    /**
     * Calculates the ceil of a rational number
     *
     * Ex: new Fraction('4.(3)').ceil() => (5 / 1)
     **/
    "ceil": function (places) {

      places = C_TEN ** BigInt(places || 0);

      return newFraction(trunc(this["s"] * places * this["n"] / this["d"]) +
        (places * this["n"] % this["d"] > C_ZERO && this["s"] >= C_ZERO ? C_ONE : C_ZERO),
        places);
    },

    /**
     * Calculates the floor of a rational number
     *
     * Ex: new Fraction('4.(3)').floor() => (4 / 1)
     **/
    "floor": function (places) {

      places = C_TEN ** BigInt(places || 0);

      return newFraction(trunc(this["s"] * places * this["n"] / this["d"]) -
        (places * this["n"] % this["d"] > C_ZERO && this["s"] < C_ZERO ? C_ONE : C_ZERO),
        places);
    },

    /**
     * Rounds a rational numbers
     *
     * Ex: new Fraction('4.(3)').round() => (4 / 1)
     **/
    "round": function (places) {

      places = C_TEN ** BigInt(places || 0);

      /* Derivation:

      s >= 0:
        round(n / d) = trunc(n / d) + (n % d) / d >= 0.5 ? 1 : 0
                     = trunc(n / d) + 2(n % d) >= d ? 1 : 0
      s < 0:
        round(n / d) =-trunc(n / d) - (n % d) / d > 0.5 ? 1 : 0
                     =-trunc(n / d) - 2(n % d) > d ? 1 : 0

      =>:

      round(s * n / d) = s * trunc(n / d) + s * (C + 2(n % d) > d ? 1 : 0)
          where C = s >= 0 ? 1 : 0, to fix the >= for the positve case.
      */

      return newFraction(trunc(this["s"] * places * this["n"] / this["d"]) +
        this["s"] * ((this["s"] >= C_ZERO ? C_ONE : C_ZERO) + C_TWO * (places * this["n"] % this["d"]) > this["d"] ? C_ONE : C_ZERO),
        places);
    },

    /**
      * Rounds a rational number to a multiple of another rational number
      *
      * Ex: new Fraction('0.9').roundTo("1/8") => 7 / 8
      **/
    "roundTo": function (a, b) {

      /*
      k * x/y ≤ a/b < (k+1) * x/y
      ⇔ k ≤ a/b / (x/y) < (k+1)
      ⇔ k = floor(a/b * y/x)
      ⇔ k = floor((a * y) / (b * x))
      */

      parse(a, b);

      const n = this['n'] * P['d'];
      const d = this['d'] * P['n'];
      const r = n % d;

      // round(n / d) = trunc(n / d) + 2(n % d) >= d ? 1 : 0
      let k = trunc(n / d);
      if (r + r >= d) {
        k++;
      }
      return newFraction(this['s'] * k * P['n'], P['d']);
    },

    /**
     * Check if two rational numbers are divisible
     *
     * Ex: new Fraction(19.6).divisible(1.5);
     */
    "divisible": function (a, b) {

      parse(a, b);
      return !(!(P["n"] * this["d"]) || ((this["n"] * P["d"]) % (P["n"] * this["d"])));
    },

    /**
     * Returns a decimal representation of the fraction
     *
     * Ex: new Fraction("100.'91823'").valueOf() => 100.91823918239183
     **/
    'valueOf': function () {
      // Best we can do so far
      return Number(this["s"] * this["n"]) / Number(this["d"]);
    },

    /**
     * Creates a string representation of a fraction with all digits
     *
     * Ex: new Fraction("100.'91823'").toString() => "100.(91823)"
     **/
    'toString': function (dec) {

      let N = this["n"];
      let D = this["d"];

      dec = dec || 15; // 15 = decimal places when no repetition

      let cycLen = cycleLen(N, D); // Cycle length
      let cycOff = cycleStart(N, D, cycLen); // Cycle start

      let str = this['s'] < C_ZERO ? "-" : "";

      // Append integer part
      str += trunc(N / D);

      N %= D;
      N *= C_TEN;

      if (N)
        str += ".";

      if (cycLen) {

        for (let i = cycOff; i--;) {
          str += trunc(N / D);
          N %= D;
          N *= C_TEN;
        }
        str += "(";
        for (let i = cycLen; i--;) {
          str += trunc(N / D);
          N %= D;
          N *= C_TEN;
        }
        str += ")";
      } else {
        for (let i = dec; N && i--;) {
          str += trunc(N / D);
          N %= D;
          N *= C_TEN;
        }
      }
      return str;
    },

    /**
     * Returns a string-fraction representation of a Fraction object
     *
     * Ex: new Fraction("1.'3'").toFraction() => "4 1/3"
     **/
    'toFraction': function (showMixed) {

      let n = this["n"];
      let d = this["d"];
      let str = this['s'] < C_ZERO ? "-" : "";

      if (d === C_ONE) {
        str += n;
      } else {
        let whole = trunc(n / d);
        if (showMixed && whole > C_ZERO) {
          str += whole;
          str += " ";
          n %= d;
        }

        str += n;
        str += '/';
        str += d;
      }
      return str;
    },

    /**
     * Returns a latex representation of a Fraction object
     *
     * Ex: new Fraction("1.'3'").toLatex() => "\frac{4}{3}"
     **/
    'toLatex': function (showMixed) {

      let n = this["n"];
      let d = this["d"];
      let str = this['s'] < C_ZERO ? "-" : "";

      if (d === C_ONE) {
        str += n;
      } else {
        let whole = trunc(n / d);
        if (showMixed && whole > C_ZERO) {
          str += whole;
          n %= d;
        }

        str += "\\frac{";
        str += n;
        str += '}{';
        str += d;
        str += '}';
      }
      return str;
    },

    /**
     * Returns an array of continued fraction elements
     *
     * Ex: new Fraction("7/8").toContinued() => [0,1,7]
     */
    'toContinued': function () {

      let a = this['n'];
      let b = this['d'];
      let res = [];

      do {
        res.push(trunc(a / b));
        let t = a % b;
        a = b;
        b = t;
      } while (a !== C_ONE);

      return res;
    },

    "simplify": function (eps) {

      const ieps = BigInt(1 / (eps || 0.001) | 0);

      const thisABS = this['abs']();
      const cont = thisABS['toContinued']();

      for (let i = 1; i < cont.length; i++) {

        let s = newFraction(cont[i - 1], C_ONE);
        for (let k = i - 2; k >= 0; k--) {
          s = s['inverse']()['add'](cont[k]);
        }

        let t = s['sub'](thisABS);
        if (t['n'] * ieps < t['d']) { // More robust than Math.abs(t.valueOf()) < eps
          return s['mul'](this['s']);
        }
      }
      return this;
    }
  };

  var __defProp$5 = Object.defineProperty;
  var __defNormalProp$5 = (obj, key, value) => key in obj ? __defProp$5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField$5 = (obj, key, value) => __defNormalProp$5(obj, typeof key !== "symbol" ? key + "" : key, value);
  class BpsChange {
    constructor(beat, bps) {
      __publicField$5(this, "beat");
      __publicField$5(this, "bps");
      this.beat = beat;
      this.bps = bps;
    }
    /**
     * Calculates the BPM from the BPS.
     * 
     * @returns The BPM.
     */
    bpm() {
      return 60 * this.bps;
    }
    /**
     * Compares two BPS changes by their {@link beat} property.
     */
    static compare(a, b) {
      return a.beat.compare(b.beat);
    }
  }
  class BpsList {
    constructor(initialBps = 2) {
      __publicField$5(this, "initialBps");
      __publicField$5(this, "bpsChanges");
      this.initialBps = initialBps;
      this.bpsChanges = [];
    }
    addBpsChange(beat, bps) {
      this.bpsChanges.push(new BpsChange(beat, bps));
      this.bpsChanges.sort(BpsChange.compare);
    }
    addBpmChange(beat, bpm) {
      this.addBpsChange(beat, bpm / 60);
    }
    initialBpm() {
      return this.initialBps * 60;
    }
    bpsAt(beat) {
      let lower = -1;
      let upper = this.bpsChanges.length;
      while (upper - lower > 1) {
        const mid = Math.floor((lower + upper) / 2);
        const midBeat = mid >= 0 ? this.bpsChanges[mid].beat : new Fraction(0);
        if (midBeat.gt(beat)) {
          upper = mid;
        } else {
          lower = mid;
        }
      }
      return upper === 0 ? this.initialBps : this.bpsChanges[lower].bps;
    }
    timeAt(beat) {
      let result = 0;
      let currentBeat = new Fraction(0);
      let bps = this.initialBps;
      for (const { beat: newBeat, bps: newBps } of this.bpsChanges) {
        if (newBeat.gte(beat)) {
          break;
        }
        result += newBeat.sub(currentBeat).valueOf() / bps;
        currentBeat = newBeat;
        bps = newBps;
      }
      return result + beat.sub(currentBeat).valueOf() / bps;
    }
    bpmAt(beat) {
      return this.bpsAt(beat) * 60;
    }
    deduplicate() {
      let current = this.initialBps;
      for (let i = 0; i < this.bpsChanges.length; ) {
        const bpsChange = this.bpsChanges[i];
        if (bpsChange.bps === current) {
          this.bpsChanges.splice(i, 1);
        } else {
          current = bpsChange.bps;
          i++;
        }
      }
    }
    encodedLength() {
      return 4 + 8 + this.bpsChanges.length * 16;
    }
    encode(output, offset) {
      output.setUint32(offset, this.bpsChanges.length, true);
      offset += 4;
      output.setFloat64(offset, this.initialBps, true);
      offset += 8;
      let lastBeat = new Fraction(0);
      for (const bpsChange of this.bpsChanges) {
        const deltaBeat = bpsChange.beat.sub(lastBeat);
        output.setUint32(offset, Number(deltaBeat.n), true);
        offset += 4;
        output.setUint32(offset, Number(deltaBeat.d), true);
        offset += 4;
        output.setFloat64(offset, bpsChange.bps, true);
        offset += 8;
        lastBeat = bpsChange.beat;
      }
      return offset;
    }
    static decode(input, offset) {
      const bpsList = new BpsList();
      const bpsChangeCount = input.getUint32(offset, true);
      offset += 4;
      bpsList.initialBps = input.getFloat64(offset, true);
      offset += 8;
      let lastBeat = new Fraction(0);
      for (let i = 0; i < bpsChangeCount; i++) {
        const deltaBeatN = input.getUint32(offset, true);
        offset += 4;
        const deltaBeatD = input.getUint32(offset, true);
        offset += 4;
        const deltaBeat = new Fraction(deltaBeatN, deltaBeatD);
        const bps = input.getFloat64(offset, true);
        offset += 8;
        const beat = lastBeat.add(deltaBeat);
        bpsList.bpsChanges.push(new BpsChange(beat, bps));
        lastBeat = beat;
      }
      bpsList.bpsChanges.sort(BpsChange.compare);
      return bpsList;
    }
    copyFrom(other) {
      this.initialBps = other.initialBps;
      this.bpsChanges.length = 0;
      for (const bpsChange of other.bpsChanges) {
        this.bpsChanges.push(new BpsChange(bpsChange.beat.clone(), bpsChange.bps));
      }
    }
  }

  var __defProp$4 = Object.defineProperty;
  var __defNormalProp$4 = (obj, key, value) => key in obj ? __defProp$4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField$4 = (obj, key, value) => __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
  class SpeedChange {
    constructor(beat, speed) {
      __publicField$4(this, "beat");
      __publicField$4(this, "speed");
      this.beat = beat;
      this.speed = speed;
    }
    /**
     * Compares two speed changes by their {@link beat} property.
     */
    static compare(a, b) {
      return a.beat.compare(b.beat);
    }
  }
  class SpeedList {
    constructor(initialSpeed = 1) {
      __publicField$4(this, "initialSpeed");
      __publicField$4(this, "speedChanges");
      this.initialSpeed = initialSpeed;
      this.speedChanges = [];
    }
    addSpeedChange(beat, bps) {
      this.speedChanges.push(new SpeedChange(beat, bps));
      this.speedChanges.sort(SpeedChange.compare);
    }
    /**
     * Binary searches the {@link speedChanges} to find the speed at the given beat.
     * 
     * @param beat The beat at which to find the speed.
     * @returns The speed at the given beat.
     */
    speedAt(beat) {
      let lower = -1;
      let upper = this.speedChanges.length;
      while (upper - lower > 1) {
        const mid = Math.floor((lower + upper) / 2);
        const midBeat = mid >= 0 ? this.speedChanges[mid].beat : new Fraction(0);
        if (midBeat.gt(beat)) {
          upper = mid;
        } else {
          lower = mid;
        }
      }
      return upper === 0 ? this.initialSpeed : this.speedChanges[lower].speed;
    }
    /**
     * Assuming that a 1D particle moves at velocity specified piecewisely by the speed list,
     * this function returns the position of the particle at the given time.
     * 
     * @param time The time at which to find the position.
     * @param bpsList The BPS list to use for getting the time of each speed change.
     * 
     * @see {@link Chart.yAt}
     */
    yAt(time, bpsList) {
      let result = 0;
      let currentTime = 0;
      let speed = this.initialSpeed;
      for (const { beat: newBeat, speed: newSpeed } of this.speedChanges) {
        const newTime = bpsList.timeAt(newBeat);
        if (newTime >= time) {
          break;
        }
        result += (newTime - currentTime) * speed;
        currentTime = newTime;
        speed = newSpeed;
      }
      return result + (time - currentTime) * speed;
    }
    deduplicate() {
      let current = this.initialSpeed;
      for (let i = 0; i < this.speedChanges.length; ) {
        const speedChange = this.speedChanges[i];
        if (speedChange.speed === current) {
          this.speedChanges.splice(i, 1);
        } else {
          current = speedChange.speed;
          i++;
        }
      }
    }
    encodedLength() {
      return 4 + 8 + this.speedChanges.length * 16;
    }
    encode(output, offset) {
      output.setUint32(offset, this.speedChanges.length, true);
      offset += 4;
      output.setFloat64(offset, this.initialSpeed, true);
      offset += 8;
      let lastBeat = new Fraction(0);
      for (const speedChange of this.speedChanges) {
        const deltaBeat = speedChange.beat.sub(lastBeat);
        output.setUint32(offset, Number(deltaBeat.n), true);
        offset += 4;
        output.setUint32(offset, Number(deltaBeat.d), true);
        offset += 4;
        output.setFloat64(offset, speedChange.speed, true);
        offset += 8;
        lastBeat = speedChange.beat;
      }
      return offset;
    }
    static decode(input, offset) {
      const speedList = new SpeedList();
      const bpsChangeCount = input.getUint32(offset, true);
      offset += 4;
      speedList.initialSpeed = input.getFloat64(offset, true);
      offset += 8;
      let lastBeat = new Fraction(0);
      for (let i = 0; i < bpsChangeCount; i++) {
        const deltaBeatN = input.getUint32(offset, true);
        offset += 4;
        const deltaBeatD = input.getUint32(offset, true);
        offset += 4;
        const deltaBeat = new Fraction(deltaBeatN, deltaBeatD);
        const bps = input.getFloat64(offset, true);
        offset += 8;
        const beat = lastBeat.add(deltaBeat);
        speedList.speedChanges.push(new SpeedChange(beat, bps));
        lastBeat = beat;
      }
      speedList.speedChanges.sort(SpeedChange.compare);
      return speedList;
    }
    copyFrom(other) {
      this.initialSpeed = other.initialSpeed;
      this.speedChanges.length = 0;
      for (const speedChange of other.speedChanges) {
        this.speedChanges.push(new SpeedChange(speedChange.beat.clone(), speedChange.speed));
      }
    }
  }

  /* eslint-disable no-restricted-globals, no-restricted-syntax */
  /* global SharedArrayBuffer */


  /** @type {<T extends (...args: any) => any>(target: T) => (thisArg: ThisType<T>, ...args: any[]) => any} */
  function uncurryThis(target) {
    return (thisArg, ...args) => {
      return ReflectApply(target, thisArg, args);
    };
  }

  /** @type {(target: any, key: string | symbol) => (thisArg: any, ...args: any[]) => any} */
  function uncurryThisGetter(target, key) {
    return uncurryThis(
      ReflectGetOwnPropertyDescriptor(
        target,
        key
      ).get
    );
  }

  // Reflect
  const {
    apply: ReflectApply,
    getOwnPropertyDescriptor: ReflectGetOwnPropertyDescriptor,
    getPrototypeOf: ReflectGetPrototypeOf,
    ownKeys: ReflectOwnKeys} = Reflect;

  // Number
  const {
    EPSILON,
    isFinite: NumberIsFinite,
    isNaN: NumberIsNaN,
  } = Number;

  // Symbol
  const {
    iterator: SymbolIterator,
    toStringTag: SymbolToStringTag} = Symbol;

  // Object
  const NativeObject = Object;
  const {
    create: ObjectCreate,
    defineProperty: ObjectDefineProperty} = NativeObject;

  // Array
  const NativeArray = Array;
  const ArrayPrototype = NativeArray.prototype;
  const NativeArrayPrototypeSymbolIterator = ArrayPrototype[SymbolIterator];
  /** @type {<T>(array: T[]) => IterableIterator<T>} */
  const ArrayPrototypeSymbolIterator = uncurryThis(NativeArrayPrototypeSymbolIterator);

  // Math
  const {
    abs: MathAbs} = Math;

  // ArrayBuffer
  const NativeArrayBuffer = ArrayBuffer;
  const ArrayBufferPrototype = NativeArrayBuffer.prototype;
  /** @type {(buffer: ArrayBuffer) => ArrayBuffer} */
  uncurryThisGetter(ArrayBufferPrototype, "byteLength");

  // SharedArrayBuffer
  const NativeSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : null;
  /** @type {(buffer: SharedArrayBuffer) => SharedArrayBuffer} */
  NativeSharedArrayBuffer
    && uncurryThisGetter(NativeSharedArrayBuffer.prototype, "byteLength");

  // TypedArray
  /** @typedef {Uint8Array|Uint8ClampedArray|Uint16Array|Uint32Array|Int8Array|Int16Array|Int32Array|Float32Array|Float64Array|BigUint64Array|BigInt64Array} TypedArray */
  /** @type {any} */
  const TypedArray = ReflectGetPrototypeOf(Uint8Array);
  TypedArray.from;
  const TypedArrayPrototype = TypedArray.prototype;
  TypedArrayPrototype[SymbolIterator];
  /** @type {(typedArray: TypedArray) => IterableIterator<number>} */
  uncurryThis(TypedArrayPrototype.keys);
  /** @type {(typedArray: TypedArray) => IterableIterator<number>} */
  uncurryThis(
    TypedArrayPrototype.values
  );
  /** @type {(typedArray: TypedArray) => IterableIterator<[number, number]>} */
  uncurryThis(
    TypedArrayPrototype.entries
  );
  /** @type {(typedArray: TypedArray, array: ArrayLike<number>, offset?: number) => void} */
  uncurryThis(TypedArrayPrototype.set);
  /** @type {<T extends TypedArray>(typedArray: T) => T} */
  uncurryThis(
    TypedArrayPrototype.reverse
  );
  /** @type {<T extends TypedArray>(typedArray: T, value: number, start?: number, end?: number) => T} */
  uncurryThis(TypedArrayPrototype.fill);
  /** @type {<T extends TypedArray>(typedArray: T, target: number, start: number, end?: number) => T} */
  uncurryThis(
    TypedArrayPrototype.copyWithin
  );
  /** @type {<T extends TypedArray>(typedArray: T, compareFn?: (a: number, b: number) => number) => T} */
  uncurryThis(TypedArrayPrototype.sort);
  /** @type {<T extends TypedArray>(typedArray: T, start?: number, end?: number) => T} */
  uncurryThis(TypedArrayPrototype.slice);
  /** @type {<T extends TypedArray>(typedArray: T, start?: number, end?: number) => T} */
  uncurryThis(
    TypedArrayPrototype.subarray
  );
  /** @type {((typedArray: TypedArray) => ArrayBuffer)} */
  uncurryThisGetter(
    TypedArrayPrototype,
    "buffer"
  );
  /** @type {((typedArray: TypedArray) => number)} */
  uncurryThisGetter(
    TypedArrayPrototype,
    "byteOffset"
  );
  /** @type {((typedArray: TypedArray) => number)} */
  uncurryThisGetter(
    TypedArrayPrototype,
    "length"
  );
  /** @type {(target: unknown) => string} */
  uncurryThisGetter(
    TypedArrayPrototype,
    SymbolToStringTag
  );

  // Uint8Array
  const NativeUint8Array = Uint8Array;

  // Uint16Array
  const NativeUint16Array = Uint16Array;

  // Uint32Array
  const NativeUint32Array = Uint32Array;

  // Float32Array
  const NativeFloat32Array = Float32Array;

  // ArrayIterator
  /** @type {any} */
  const ArrayIteratorPrototype = ReflectGetPrototypeOf([][SymbolIterator]());
  /** @type {<T>(arrayIterator: IterableIterator<T>) => IteratorResult<T>} */
  const ArrayIteratorPrototypeNext = uncurryThis(ArrayIteratorPrototype.next);

  // Generator
  /** @type {<T = unknown, TReturn = any, TNext = unknown>(generator: Generator<T, TReturn, TNext>, value?: TNext) => T} */
  const GeneratorPrototypeNext = uncurryThis((function* () {})().next);

  // Iterator
  const IteratorPrototype = ReflectGetPrototypeOf(ArrayIteratorPrototype);

  // DataView
  const DataViewPrototype = DataView.prototype;
  /** @type {(dataView: DataView, byteOffset: number, littleEndian?: boolean) => number} */
  const DataViewPrototypeGetUint16 = uncurryThis(
    DataViewPrototype.getUint16
  );
  /** @type {(dataView: DataView, byteOffset: number, value: number, littleEndian?: boolean) => void} */
  const DataViewPrototypeSetUint16 = uncurryThis(
    DataViewPrototype.setUint16
  );

  // WeakMap
  /**
   * Do not construct with arguments to avoid calling the "set" method
   * @type {{new <K extends {}, V>(): WeakMap<K, V>}}
   */
  const NativeWeakMap = WeakMap;
  const WeakMapPrototype = NativeWeakMap.prototype;
  /** @type {<K extends {}, V>(weakMap: WeakMap<K, V>, key: K) => V} */
  const WeakMapPrototypeGet = uncurryThis(WeakMapPrototype.get);
  /** @type {<K extends {}, V>(weakMap: WeakMap<K, V>, key: K, value: V) => WeakMap} */
  const WeakMapPrototypeSet = uncurryThis(WeakMapPrototype.set);

  /** @type {WeakMap<{}, IterableIterator<any>>} */
  const arrayIterators = new NativeWeakMap();

  const SafeIteratorPrototype = ObjectCreate(null, {
    next: {
      value: function next() {
        const arrayIterator = WeakMapPrototypeGet(arrayIterators, this);
        return ArrayIteratorPrototypeNext(arrayIterator);
      },
    },

    [SymbolIterator]: {
      value: function values() {
        return this;
      },
    },
  });

  /**
   * Wrap the Array around the SafeIterator If Array.prototype [@@iterator] has been modified
   * @type {<T>(array: T[]) => Iterable<T>}
   */
  function safeIfNeeded(array) {
    if (
      array[SymbolIterator] === NativeArrayPrototypeSymbolIterator &&
      ArrayIteratorPrototype.next === ArrayIteratorPrototypeNext
    ) {
      return array;
    }

    const safe = ObjectCreate(SafeIteratorPrototype);
    WeakMapPrototypeSet(arrayIterators, safe, ArrayPrototypeSymbolIterator(array));
    return safe;
  }

  /** @type {WeakMap<{}, Generator<any>>} */
  const generators = new NativeWeakMap();

  /** @see https://tc39.es/ecma262/#sec-%arrayiteratorprototype%-object */
  const DummyArrayIteratorPrototype = ObjectCreate(IteratorPrototype, {
    next: {
      value: function next() {
        const generator = WeakMapPrototypeGet(generators, this);
        return GeneratorPrototypeNext(generator);
      },
      writable: true,
      configurable: true,
    },
  });

  for (const key of ReflectOwnKeys(ArrayIteratorPrototype)) {
    // next method has already defined
    if (key === "next") {
      continue;
    }

    // Copy ArrayIteratorPrototype descriptors to DummyArrayIteratorPrototype
    ObjectDefineProperty(DummyArrayIteratorPrototype, key, ReflectGetOwnPropertyDescriptor(ArrayIteratorPrototype, key));
  }

  const INVERSE_OF_EPSILON = 1 / EPSILON;

  /**
   * rounds to the nearest value;
   * if the number falls midway, it is rounded to the nearest value with an even least significant digit
   * @param {number} num
   * @returns {number}
   */
  function roundTiesToEven(num) {
    return (num + INVERSE_OF_EPSILON) - INVERSE_OF_EPSILON;
  }

  const FLOAT16_MIN_VALUE = 6.103515625e-05;
  const FLOAT16_MAX_VALUE = 65504;
  const FLOAT16_EPSILON = 0.0009765625;

  const FLOAT16_EPSILON_MULTIPLIED_BY_FLOAT16_MIN_VALUE = FLOAT16_EPSILON * FLOAT16_MIN_VALUE;
  const FLOAT16_EPSILON_DEVIDED_BY_EPSILON = FLOAT16_EPSILON * INVERSE_OF_EPSILON;

  /**
   * round a number to a half float number
   * @param {unknown} num - double float
   * @returns {number} half float number
   */
  function roundToFloat16(num) {
    const number = +num;

    // NaN, Infinity, -Infinity, 0, -0
    if (!NumberIsFinite(number) || number === 0) {
      return number;
    }

    // finite except 0, -0
    const sign = number > 0 ? 1 : -1;
    const absolute = MathAbs(number);

    // small number
    if (absolute < FLOAT16_MIN_VALUE) {
      return sign * roundTiesToEven(absolute / FLOAT16_EPSILON_MULTIPLIED_BY_FLOAT16_MIN_VALUE) * FLOAT16_EPSILON_MULTIPLIED_BY_FLOAT16_MIN_VALUE;
    }

    const temp = (1 + FLOAT16_EPSILON_DEVIDED_BY_EPSILON) * absolute;
    const result = temp - (temp - absolute);

    // large number
    if (result > FLOAT16_MAX_VALUE || NumberIsNaN(result)) {
      return sign * Infinity;
    }

    return sign * result;
  }

  // base algorithm: http://fox-toolkit.org/ftp/fasthalffloatconversion.pdf

  const buffer$1 = new NativeArrayBuffer(4);
  const floatView = new NativeFloat32Array(buffer$1);
  const uint32View = new NativeUint32Array(buffer$1);

  const baseTable = new NativeUint16Array(512);
  const shiftTable = new NativeUint8Array(512);

  for (let i = 0; i < 256; ++i) {
    const e = i - 127;

    // very small number (0, -0)
    if (e < -24) {
      baseTable[i]         = 0x0000;
      baseTable[i | 0x100] = 0x8000;
      shiftTable[i]         = 24;
      shiftTable[i | 0x100] = 24;

    // small number (denorm)
    } else if (e < -14) {
      baseTable[i]         =  0x0400 >> (-e - 14);
      baseTable[i | 0x100] = (0x0400 >> (-e - 14)) | 0x8000;
      shiftTable[i]         = -e - 1;
      shiftTable[i | 0x100] = -e - 1;

    // normal number
    } else if (e <= 15) {
      baseTable[i]         =  (e + 15) << 10;
      baseTable[i | 0x100] = ((e + 15) << 10) | 0x8000;
      shiftTable[i]         = 13;
      shiftTable[i | 0x100] = 13;

    // large number (Infinity, -Infinity)
    } else if (e < 128) {
      baseTable[i]         = 0x7c00;
      baseTable[i | 0x100] = 0xfc00;
      shiftTable[i]         = 24;
      shiftTable[i | 0x100] = 24;

    // stay (NaN, Infinity, -Infinity)
    } else {
      baseTable[i]         = 0x7c00;
      baseTable[i | 0x100] = 0xfc00;
      shiftTable[i]         = 13;
      shiftTable[i | 0x100] = 13;
    }
  }

  /**
   * round a number to a half float number bits
   * @param {unknown} num - double float
   * @returns {number} half float number bits
   */
  function roundToFloat16Bits(num) {
    floatView[0] = roundToFloat16(num);
    const f = uint32View[0];
    const e = (f >> 23) & 0x1ff;
    return baseTable[e] + ((f & 0x007fffff) >> shiftTable[e]);
  }

  const mantissaTable = new NativeUint32Array(2048);
  for (let i = 1; i < 1024; ++i) {
    let m = i << 13; // zero pad mantissa bits
    let e = 0; // zero exponent

    // normalized
    while ((m & 0x00800000) === 0) {
      m <<= 1;
      e -= 0x00800000; // decrement exponent
    }

    m &= -8388609; // clear leading 1 bit
    e += 0x38800000; // adjust bias

    mantissaTable[i] = m | e;
  }
  for (let i = 1024; i < 2048; ++i) {
    mantissaTable[i] = 0x38000000 + ((i - 1024) << 13);
  }

  const exponentTable = new NativeUint32Array(64);
  for (let i = 1; i < 31; ++i) {
    exponentTable[i] = i << 23;
  }
  exponentTable[31] = 0x47800000;
  exponentTable[32] = 0x80000000;
  for (let i = 33; i < 63; ++i) {
    exponentTable[i] = 0x80000000 + ((i - 32) << 23);
  }
  exponentTable[63] = 0xc7800000;

  const offsetTable = new NativeUint16Array(64);
  for (let i = 1; i < 64; ++i) {
    if (i !== 32) {
      offsetTable[i] = 1024;
    }
  }

  /**
   * convert a half float number bits to a number
   * @param {number} float16bits - half float number bits
   * @returns {number} double float
   */
  function convertToNumber(float16bits) {
    const i = float16bits >> 10;
    uint32View[0] = mantissaTable[offsetTable[i] + (float16bits & 0x3ff)] + exponentTable[i];
    return floatView[0];
  }

  /**
   * returns an unsigned 16-bit float at the specified byte offset from the start of the DataView
   * @param {DataView} dataView
   * @param {number} byteOffset
   * @param {[boolean]} opts
   * @returns {number}
   */
  function getFloat16(dataView, byteOffset, ...opts) {
    return convertToNumber(
      DataViewPrototypeGetUint16(dataView, byteOffset, ...safeIfNeeded(opts))
    );
  }

  /**
   * stores an unsigned 16-bit float value at the specified byte offset from the start of the DataView
   * @param {DataView} dataView
   * @param {number} byteOffset
   * @param {number} value
   * @param {[boolean]} opts
   */
  function setFloat16(dataView, byteOffset, value, ...opts) {
    return DataViewPrototypeSetUint16(
      dataView,
      byteOffset,
      roundToFloat16Bits(value),
      ...safeIfNeeded(opts)
    );
  }

  var __defProp$3 = Object.defineProperty;
  var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField$3 = (obj, key, value) => __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
  class Note {
    constructor(beat, trackCount, trackIndex) {
      __publicField$3(this, "beat");
      __publicField$3(this, "trackCount");
      __publicField$3(this, "trackIndex");
      __publicField$3(this, "width", 0);
      this.beat = beat;
      this.trackCount = trackCount;
      this.trackIndex = trackIndex;
    }
    /**
     * Compares two notes by their {@link beat} property.
     */
    static compare(a, b) {
      return a.beat.compare(b.beat);
    }
    /**
     * The horizontal position of the note in the range [0, 1].
     * 
     * @returns The horizontal position of the note.
     */
    x() {
      return (this.trackIndex + 0.5) / this.trackCount;
    }
    /**
     * If {@link width} is not zero, then the note is a wide note.
     * This method returns whether the note is a wide note.
     * 
     * @returns Whether this is a wide note.
     */
    isWide() {
      return this.width !== 0;
    }
  }
  class Tap extends Note {
  }
  class GroupableNote extends Note {
    constructor() {
      super(...arguments);
      /**
       * The group of notes that this note belongs to.
       * The `peers` property of every note in the group must be the same reference.
       */
      __publicField$3(this, "peers", [this.self()]);
    }
    /**
     * Just to work around TypeScript's type system.
     * @returns `this`.
     */
    self() {
      return this;
    }
    /**
     * @returns Whether this note is the first note in the group.
     */
    isBegin() {
      return this.self() === this.peers[0];
    }
    /**
     * @returns Whether this note is the last note in the group.
     */
    isEnd() {
      return this.self() === this.peers[this.peers.length - 1];
    }
    /**
     * @returns Whether this note is neither the first nor the last note in the group.
     */
    isMiddle() {
      return !this.isBegin() && !this.isEnd();
    }
    /**
     * @returns Whether this note is the only note in the group.
     */
    isIsolated() {
      return this.peers.length === 1;
    }
    /**
     * Merges different groupable notes of the same type into one group.
     * 
     * @param others The other groupable notes to merge with.
     * 
     * @example
     * ```ts
     * const note1 = new Hold(new Fraction(0), 4, 0);
     * const note2 = new Hold(new Fraction(1), 4, 1);
     * note1.mergeWith(note2);
     * console.log(note1.peers[0] === note1); // true
     * console.log(note1.peers[1] === note2); // true
     * ```
     */
    mergeWith(...others) {
      const concatenated = /* @__PURE__ */ new Set();
      for (const { peers: otherPeers } of others) {
        if (concatenated.has(otherPeers)) {
          continue;
        }
        this.peers.push(...otherPeers);
        concatenated.add(otherPeers);
      }
      this.peers.forEach((note) => note.peers = this.peers);
      this.peers.sort(Note.compare);
    }
  }
  class Hold extends GroupableNote {
  }
  class Drag extends GroupableNote {
  }
  class NoteList {
    constructor() {
      __publicField$3(this, "notes", []);
    }
    addNote(note) {
      this.notes.push(note);
      this.notes.sort(Note.compare);
    }
    encodedLength() {
      return 4 + this.notes.length * (4 + 4 + 2 + 2 + 4 + 2);
    }
    encode(output, offset) {
      const nexts = /* @__PURE__ */ new WeakMap();
      const indices = /* @__PURE__ */ new WeakMap();
      this.notes.forEach((note, index) => indices.set(note, index));
      this.notes.forEach((note) => {
        if (!nexts.has(note) && note instanceof GroupableNote) {
          const peers = note.peers;
          for (let i = 0; i < peers.length - 1; i++) {
            nexts.set(peers[i], indices.get(peers[i + 1]) - indices.get(peers[i]));
          }
        }
      });
      output.setUint32(offset, this.notes.length, true);
      offset += 4;
      let beat = new Fraction(0);
      for (let note of this.notes) {
        const deltaBeat = note.beat.sub(beat);
        output.setUint32(offset, Number(deltaBeat.n), true);
        offset += 4;
        output.setUint32(offset, Number(deltaBeat.d), true);
        offset += 4;
        output.setUint16(offset, note.trackCount, true);
        offset += 2;
        output.setUint16(offset, note.trackIndex, true);
        offset += 2;
        output.setUint32(offset, nexts.get(note), true);
        offset += 4;
        setFloat16(output, offset, note instanceof Drag ? -note.width : note.width, true);
        offset += 2;
        beat = note.beat;
      }
      return offset;
    }
    static decode(input, offset) {
      const noteList = new NoteList();
      const count = input.getUint32(offset, true);
      offset += 4;
      const prevs = /* @__PURE__ */ new Map();
      let beat = new Fraction(0);
      for (let i = 0; i < count; i++) {
        const deltaBeatN = input.getUint32(offset, true);
        offset += 4;
        const deltaBeatD = input.getUint32(offset, true);
        offset += 4;
        const trackCount = input.getUint16(offset, true);
        offset += 2;
        const trackIndex = input.getUint16(offset, true);
        offset += 2;
        const next = input.getUint32(offset, true);
        offset += 4;
        const width = getFloat16(input, offset, true);
        offset += 2;
        beat = beat.add(new Fraction(deltaBeatN, deltaBeatD));
        let note;
        if (1 / width < 0) {
          note = new Drag(beat, trackCount, trackIndex);
          note.width = -width;
          if (prevs.has(i)) {
            const peers = prevs.get(i).peers;
            peers.push(note);
            note.peers = peers;
          }
        } else if (prevs.has(i) || next) {
          note = new Hold(beat, trackCount, trackIndex);
          note.width = width;
          if (prevs.has(i)) {
            const peers = prevs.get(i).peers;
            peers.push(note);
            note.peers = peers;
          }
        } else {
          note = new Tap(beat, trackCount, trackIndex);
          note.width = width;
        }
        if (next) {
          prevs.set(i + next, note);
        }
        noteList.notes.push(note);
      }
      return noteList;
    }
  }

  var global$1 = (typeof global !== "undefined" ? global :
    typeof self !== "undefined" ? self :
    typeof window !== "undefined" ? window : {});

  var lookup = [];
  var revLookup = [];
  var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
  var inited = false;
  function init () {
    inited = true;
    var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (var i = 0, len = code.length; i < len; ++i) {
      lookup[i] = code[i];
      revLookup[code.charCodeAt(i)] = i;
    }

    revLookup['-'.charCodeAt(0)] = 62;
    revLookup['_'.charCodeAt(0)] = 63;
  }

  function toByteArray (b64) {
    if (!inited) {
      init();
    }
    var i, j, l, tmp, placeHolders, arr;
    var len = b64.length;

    if (len % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4')
    }

    // the number of equal signs (place holders)
    // if there are two placeholders, than the two characters before it
    // represent one byte
    // if there is only one, then the three characters before it represent 2 bytes
    // this is just a cheap hack to not do indexOf twice
    placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

    // base64 is 4/3 + up to two characters of the original data
    arr = new Arr(len * 3 / 4 - placeHolders);

    // if there are placeholders, only get up to the last complete 4 chars
    l = placeHolders > 0 ? len - 4 : len;

    var L = 0;

    for (i = 0, j = 0; i < l; i += 4, j += 3) {
      tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
      arr[L++] = (tmp >> 16) & 0xFF;
      arr[L++] = (tmp >> 8) & 0xFF;
      arr[L++] = tmp & 0xFF;
    }

    if (placeHolders === 2) {
      tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
      arr[L++] = tmp & 0xFF;
    } else if (placeHolders === 1) {
      tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
      arr[L++] = (tmp >> 8) & 0xFF;
      arr[L++] = tmp & 0xFF;
    }

    return arr
  }

  function tripletToBase64 (num) {
    return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
  }

  function encodeChunk (uint8, start, end) {
    var tmp;
    var output = [];
    for (var i = start; i < end; i += 3) {
      tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
      output.push(tripletToBase64(tmp));
    }
    return output.join('')
  }

  function fromByteArray (uint8) {
    if (!inited) {
      init();
    }
    var tmp;
    var len = uint8.length;
    var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
    var output = '';
    var parts = [];
    var maxChunkLength = 16383; // must be multiple of 3

    // go through the array every three bytes, we'll deal with trailing stuff later
    for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
      parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    if (extraBytes === 1) {
      tmp = uint8[len - 1];
      output += lookup[tmp >> 2];
      output += lookup[(tmp << 4) & 0x3F];
      output += '==';
    } else if (extraBytes === 2) {
      tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
      output += lookup[tmp >> 10];
      output += lookup[(tmp >> 4) & 0x3F];
      output += lookup[(tmp << 2) & 0x3F];
      output += '=';
    }

    parts.push(output);

    return parts.join('')
  }

  function read (buffer, offset, isLE, mLen, nBytes) {
    var e, m;
    var eLen = nBytes * 8 - mLen - 1;
    var eMax = (1 << eLen) - 1;
    var eBias = eMax >> 1;
    var nBits = -7;
    var i = isLE ? (nBytes - 1) : 0;
    var d = isLE ? -1 : 1;
    var s = buffer[offset + i];

    i += d;

    e = s & ((1 << (-nBits)) - 1);
    s >>= (-nBits);
    nBits += eLen;
    for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

    m = e & ((1 << (-nBits)) - 1);
    e >>= (-nBits);
    nBits += mLen;
    for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

    if (e === 0) {
      e = 1 - eBias;
    } else if (e === eMax) {
      return m ? NaN : ((s ? -1 : 1) * Infinity)
    } else {
      m = m + Math.pow(2, mLen);
      e = e - eBias;
    }
    return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
  }

  function write (buffer, value, offset, isLE, mLen, nBytes) {
    var e, m, c;
    var eLen = nBytes * 8 - mLen - 1;
    var eMax = (1 << eLen) - 1;
    var eBias = eMax >> 1;
    var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
    var i = isLE ? 0 : (nBytes - 1);
    var d = isLE ? 1 : -1;
    var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

    value = Math.abs(value);

    if (isNaN(value) || value === Infinity) {
      m = isNaN(value) ? 1 : 0;
      e = eMax;
    } else {
      e = Math.floor(Math.log(value) / Math.LN2);
      if (value * (c = Math.pow(2, -e)) < 1) {
        e--;
        c *= 2;
      }
      if (e + eBias >= 1) {
        value += rt / c;
      } else {
        value += rt * Math.pow(2, 1 - eBias);
      }
      if (value * c >= 2) {
        e++;
        c /= 2;
      }

      if (e + eBias >= eMax) {
        m = 0;
        e = eMax;
      } else if (e + eBias >= 1) {
        m = (value * c - 1) * Math.pow(2, mLen);
        e = e + eBias;
      } else {
        m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
        e = 0;
      }
    }

    for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

    e = (e << mLen) | m;
    eLen += mLen;
    for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

    buffer[offset + i - d] |= s * 128;
  }

  var toString = {}.toString;

  var isArray$1 = Array.isArray || function (arr) {
    return toString.call(arr) == '[object Array]';
  };

  /*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
   * @license  MIT
   */
  /* eslint-disable no-proto */


  var INSPECT_MAX_BYTES = 50;

  /**
   * If `Buffer.TYPED_ARRAY_SUPPORT`:
   *   === true    Use Uint8Array implementation (fastest)
   *   === false   Use Object implementation (most compatible, even IE6)
   *
   * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
   * Opera 11.6+, iOS 4.2+.
   *
   * Due to various browser bugs, sometimes the Object implementation will be used even
   * when the browser supports typed arrays.
   *
   * Note:
   *
   *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
   *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
   *
   *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
   *
   *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
   *     incorrect length in some situations.

   * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
   * get the Object implementation, which is slower but behaves correctly.
   */
  Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
    ? global$1.TYPED_ARRAY_SUPPORT
    : true;

  /*
   * Export kMaxLength after typed array support is determined.
   */
  var _kMaxLength = kMaxLength();

  function kMaxLength () {
    return Buffer.TYPED_ARRAY_SUPPORT
      ? 0x7fffffff
      : 0x3fffffff
  }

  function createBuffer (that, length) {
    if (kMaxLength() < length) {
      throw new RangeError('Invalid typed array length')
    }
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = new Uint8Array(length);
      that.__proto__ = Buffer.prototype;
    } else {
      // Fallback: Return an object instance of the Buffer class
      if (that === null) {
        that = new Buffer(length);
      }
      that.length = length;
    }

    return that
  }

  /**
   * The Buffer constructor returns instances of `Uint8Array` that have their
   * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
   * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
   * and the `Uint8Array` methods. Square bracket notation works as expected -- it
   * returns a single octet.
   *
   * The `Uint8Array` prototype remains unmodified.
   */

  function Buffer (arg, encodingOrOffset, length) {
    if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
      return new Buffer(arg, encodingOrOffset, length)
    }

    // Common case.
    if (typeof arg === 'number') {
      if (typeof encodingOrOffset === 'string') {
        throw new Error(
          'If encoding is specified then the first argument must be a string'
        )
      }
      return allocUnsafe(this, arg)
    }
    return from(this, arg, encodingOrOffset, length)
  }

  Buffer.poolSize = 8192; // not used by this implementation

  // TODO: Legacy, not needed anymore. Remove in next major version.
  Buffer._augment = function (arr) {
    arr.__proto__ = Buffer.prototype;
    return arr
  };

  function from (that, value, encodingOrOffset, length) {
    if (typeof value === 'number') {
      throw new TypeError('"value" argument must not be a number')
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return fromArrayBuffer(that, value, encodingOrOffset, length)
    }

    if (typeof value === 'string') {
      return fromString(that, value, encodingOrOffset)
    }

    return fromObject(that, value)
  }

  /**
   * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
   * if value is a number.
   * Buffer.from(str[, encoding])
   * Buffer.from(array)
   * Buffer.from(buffer)
   * Buffer.from(arrayBuffer[, byteOffset[, length]])
   **/
  Buffer.from = function (value, encodingOrOffset, length) {
    return from(null, value, encodingOrOffset, length)
  };

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    Buffer.prototype.__proto__ = Uint8Array.prototype;
    Buffer.__proto__ = Uint8Array;
    if (typeof Symbol !== 'undefined' && Symbol.species &&
        Buffer[Symbol.species] === Buffer) ;
  }

  function assertSize (size) {
    if (typeof size !== 'number') {
      throw new TypeError('"size" argument must be a number')
    } else if (size < 0) {
      throw new RangeError('"size" argument must not be negative')
    }
  }

  function alloc (that, size, fill, encoding) {
    assertSize(size);
    if (size <= 0) {
      return createBuffer(that, size)
    }
    if (fill !== undefined) {
      // Only pay attention to encoding if it's a string. This
      // prevents accidentally sending in a number that would
      // be interpretted as a start offset.
      return typeof encoding === 'string'
        ? createBuffer(that, size).fill(fill, encoding)
        : createBuffer(that, size).fill(fill)
    }
    return createBuffer(that, size)
  }

  /**
   * Creates a new filled Buffer instance.
   * alloc(size[, fill[, encoding]])
   **/
  Buffer.alloc = function (size, fill, encoding) {
    return alloc(null, size, fill, encoding)
  };

  function allocUnsafe (that, size) {
    assertSize(size);
    that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
    if (!Buffer.TYPED_ARRAY_SUPPORT) {
      for (var i = 0; i < size; ++i) {
        that[i] = 0;
      }
    }
    return that
  }

  /**
   * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
   * */
  Buffer.allocUnsafe = function (size) {
    return allocUnsafe(null, size)
  };
  /**
   * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
   */
  Buffer.allocUnsafeSlow = function (size) {
    return allocUnsafe(null, size)
  };

  function fromString (that, string, encoding) {
    if (typeof encoding !== 'string' || encoding === '') {
      encoding = 'utf8';
    }

    if (!Buffer.isEncoding(encoding)) {
      throw new TypeError('"encoding" must be a valid string encoding')
    }

    var length = byteLength(string, encoding) | 0;
    that = createBuffer(that, length);

    var actual = that.write(string, encoding);

    if (actual !== length) {
      // Writing a hex string, for example, that contains invalid characters will
      // cause everything after the first invalid character to be ignored. (e.g.
      // 'abxxcd' will be treated as 'ab')
      that = that.slice(0, actual);
    }

    return that
  }

  function fromArrayLike (that, array) {
    var length = array.length < 0 ? 0 : checked(array.length) | 0;
    that = createBuffer(that, length);
    for (var i = 0; i < length; i += 1) {
      that[i] = array[i] & 255;
    }
    return that
  }

  function fromArrayBuffer (that, array, byteOffset, length) {
    array.byteLength; // this throws if `array` is not a valid ArrayBuffer

    if (byteOffset < 0 || array.byteLength < byteOffset) {
      throw new RangeError('\'offset\' is out of bounds')
    }

    if (array.byteLength < byteOffset + (length || 0)) {
      throw new RangeError('\'length\' is out of bounds')
    }

    if (byteOffset === undefined && length === undefined) {
      array = new Uint8Array(array);
    } else if (length === undefined) {
      array = new Uint8Array(array, byteOffset);
    } else {
      array = new Uint8Array(array, byteOffset, length);
    }

    if (Buffer.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = array;
      that.__proto__ = Buffer.prototype;
    } else {
      // Fallback: Return an object instance of the Buffer class
      that = fromArrayLike(that, array);
    }
    return that
  }

  function fromObject (that, obj) {
    if (internalIsBuffer(obj)) {
      var len = checked(obj.length) | 0;
      that = createBuffer(that, len);

      if (that.length === 0) {
        return that
      }

      obj.copy(that, 0, 0, len);
      return that
    }

    if (obj) {
      if ((typeof ArrayBuffer !== 'undefined' &&
          obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
        if (typeof obj.length !== 'number' || isnan(obj.length)) {
          return createBuffer(that, 0)
        }
        return fromArrayLike(that, obj)
      }

      if (obj.type === 'Buffer' && isArray$1(obj.data)) {
        return fromArrayLike(that, obj.data)
      }
    }

    throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
  }

  function checked (length) {
    // Note: cannot use `length < kMaxLength()` here because that fails when
    // length is NaN (which is otherwise coerced to zero.)
    if (length >= kMaxLength()) {
      throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                           'size: 0x' + kMaxLength().toString(16) + ' bytes')
    }
    return length | 0
  }

  function SlowBuffer (length) {
    if (+length != length) { // eslint-disable-line eqeqeq
      length = 0;
    }
    return Buffer.alloc(+length)
  }
  Buffer.isBuffer = isBuffer$1;
  function internalIsBuffer (b) {
    return !!(b != null && b._isBuffer)
  }

  Buffer.compare = function compare (a, b) {
    if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
      throw new TypeError('Arguments must be Buffers')
    }

    if (a === b) return 0

    var x = a.length;
    var y = b.length;

    for (var i = 0, len = Math.min(x, y); i < len; ++i) {
      if (a[i] !== b[i]) {
        x = a[i];
        y = b[i];
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  };

  Buffer.isEncoding = function isEncoding (encoding) {
    switch (String(encoding).toLowerCase()) {
      case 'hex':
      case 'utf8':
      case 'utf-8':
      case 'ascii':
      case 'latin1':
      case 'binary':
      case 'base64':
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return true
      default:
        return false
    }
  };

  Buffer.concat = function concat (list, length) {
    if (!isArray$1(list)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }

    if (list.length === 0) {
      return Buffer.alloc(0)
    }

    var i;
    if (length === undefined) {
      length = 0;
      for (i = 0; i < list.length; ++i) {
        length += list[i].length;
      }
    }

    var buffer = Buffer.allocUnsafe(length);
    var pos = 0;
    for (i = 0; i < list.length; ++i) {
      var buf = list[i];
      if (!internalIsBuffer(buf)) {
        throw new TypeError('"list" argument must be an Array of Buffers')
      }
      buf.copy(buffer, pos);
      pos += buf.length;
    }
    return buffer
  };

  function byteLength (string, encoding) {
    if (internalIsBuffer(string)) {
      return string.length
    }
    if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
        (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
      return string.byteLength
    }
    if (typeof string !== 'string') {
      string = '' + string;
    }

    var len = string.length;
    if (len === 0) return 0

    // Use a for loop to avoid recursion
    var loweredCase = false;
    for (;;) {
      switch (encoding) {
        case 'ascii':
        case 'latin1':
        case 'binary':
          return len
        case 'utf8':
        case 'utf-8':
        case undefined:
          return utf8ToBytes(string).length
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return len * 2
        case 'hex':
          return len >>> 1
        case 'base64':
          return base64ToBytes(string).length
        default:
          if (loweredCase) return utf8ToBytes(string).length // assume utf8
          encoding = ('' + encoding).toLowerCase();
          loweredCase = true;
      }
    }
  }
  Buffer.byteLength = byteLength;

  function slowToString (encoding, start, end) {
    var loweredCase = false;

    // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
    // property of a typed array.

    // This behaves neither like String nor Uint8Array in that we set start/end
    // to their upper/lower bounds if the value passed is out of range.
    // undefined is handled specially as per ECMA-262 6th Edition,
    // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
    if (start === undefined || start < 0) {
      start = 0;
    }
    // Return early if start > this.length. Done here to prevent potential uint32
    // coercion fail below.
    if (start > this.length) {
      return ''
    }

    if (end === undefined || end > this.length) {
      end = this.length;
    }

    if (end <= 0) {
      return ''
    }

    // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
    end >>>= 0;
    start >>>= 0;

    if (end <= start) {
      return ''
    }

    if (!encoding) encoding = 'utf8';

    while (true) {
      switch (encoding) {
        case 'hex':
          return hexSlice(this, start, end)

        case 'utf8':
        case 'utf-8':
          return utf8Slice(this, start, end)

        case 'ascii':
          return asciiSlice(this, start, end)

        case 'latin1':
        case 'binary':
          return latin1Slice(this, start, end)

        case 'base64':
          return base64Slice(this, start, end)

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return utf16leSlice(this, start, end)

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
          encoding = (encoding + '').toLowerCase();
          loweredCase = true;
      }
    }
  }

  // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
  // Buffer instances.
  Buffer.prototype._isBuffer = true;

  function swap (b, n, m) {
    var i = b[n];
    b[n] = b[m];
    b[m] = i;
  }

  Buffer.prototype.swap16 = function swap16 () {
    var len = this.length;
    if (len % 2 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 16-bits')
    }
    for (var i = 0; i < len; i += 2) {
      swap(this, i, i + 1);
    }
    return this
  };

  Buffer.prototype.swap32 = function swap32 () {
    var len = this.length;
    if (len % 4 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 32-bits')
    }
    for (var i = 0; i < len; i += 4) {
      swap(this, i, i + 3);
      swap(this, i + 1, i + 2);
    }
    return this
  };

  Buffer.prototype.swap64 = function swap64 () {
    var len = this.length;
    if (len % 8 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 64-bits')
    }
    for (var i = 0; i < len; i += 8) {
      swap(this, i, i + 7);
      swap(this, i + 1, i + 6);
      swap(this, i + 2, i + 5);
      swap(this, i + 3, i + 4);
    }
    return this
  };

  Buffer.prototype.toString = function toString () {
    var length = this.length | 0;
    if (length === 0) return ''
    if (arguments.length === 0) return utf8Slice(this, 0, length)
    return slowToString.apply(this, arguments)
  };

  Buffer.prototype.equals = function equals (b) {
    if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
    if (this === b) return true
    return Buffer.compare(this, b) === 0
  };

  Buffer.prototype.inspect = function inspect () {
    var str = '';
    var max = INSPECT_MAX_BYTES;
    if (this.length > 0) {
      str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
      if (this.length > max) str += ' ... ';
    }
    return '<Buffer ' + str + '>'
  };

  Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
    if (!internalIsBuffer(target)) {
      throw new TypeError('Argument must be a Buffer')
    }

    if (start === undefined) {
      start = 0;
    }
    if (end === undefined) {
      end = target ? target.length : 0;
    }
    if (thisStart === undefined) {
      thisStart = 0;
    }
    if (thisEnd === undefined) {
      thisEnd = this.length;
    }

    if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
      throw new RangeError('out of range index')
    }

    if (thisStart >= thisEnd && start >= end) {
      return 0
    }
    if (thisStart >= thisEnd) {
      return -1
    }
    if (start >= end) {
      return 1
    }

    start >>>= 0;
    end >>>= 0;
    thisStart >>>= 0;
    thisEnd >>>= 0;

    if (this === target) return 0

    var x = thisEnd - thisStart;
    var y = end - start;
    var len = Math.min(x, y);

    var thisCopy = this.slice(thisStart, thisEnd);
    var targetCopy = target.slice(start, end);

    for (var i = 0; i < len; ++i) {
      if (thisCopy[i] !== targetCopy[i]) {
        x = thisCopy[i];
        y = targetCopy[i];
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  };

  // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
  // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
  //
  // Arguments:
  // - buffer - a Buffer to search
  // - val - a string, Buffer, or number
  // - byteOffset - an index into `buffer`; will be clamped to an int32
  // - encoding - an optional encoding, relevant is val is a string
  // - dir - true for indexOf, false for lastIndexOf
  function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
    // Empty buffer means no match
    if (buffer.length === 0) return -1

    // Normalize byteOffset
    if (typeof byteOffset === 'string') {
      encoding = byteOffset;
      byteOffset = 0;
    } else if (byteOffset > 0x7fffffff) {
      byteOffset = 0x7fffffff;
    } else if (byteOffset < -2147483648) {
      byteOffset = -2147483648;
    }
    byteOffset = +byteOffset;  // Coerce to Number.
    if (isNaN(byteOffset)) {
      // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
      byteOffset = dir ? 0 : (buffer.length - 1);
    }

    // Normalize byteOffset: negative offsets start from the end of the buffer
    if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
    if (byteOffset >= buffer.length) {
      if (dir) return -1
      else byteOffset = buffer.length - 1;
    } else if (byteOffset < 0) {
      if (dir) byteOffset = 0;
      else return -1
    }

    // Normalize val
    if (typeof val === 'string') {
      val = Buffer.from(val, encoding);
    }

    // Finally, search either indexOf (if dir is true) or lastIndexOf
    if (internalIsBuffer(val)) {
      // Special case: looking for empty string/buffer always fails
      if (val.length === 0) {
        return -1
      }
      return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
    } else if (typeof val === 'number') {
      val = val & 0xFF; // Search for a byte value [0-255]
      if (Buffer.TYPED_ARRAY_SUPPORT &&
          typeof Uint8Array.prototype.indexOf === 'function') {
        if (dir) {
          return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
        } else {
          return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
        }
      }
      return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
    }

    throw new TypeError('val must be string, number or Buffer')
  }

  function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
    var indexSize = 1;
    var arrLength = arr.length;
    var valLength = val.length;

    if (encoding !== undefined) {
      encoding = String(encoding).toLowerCase();
      if (encoding === 'ucs2' || encoding === 'ucs-2' ||
          encoding === 'utf16le' || encoding === 'utf-16le') {
        if (arr.length < 2 || val.length < 2) {
          return -1
        }
        indexSize = 2;
        arrLength /= 2;
        valLength /= 2;
        byteOffset /= 2;
      }
    }

    function read (buf, i) {
      if (indexSize === 1) {
        return buf[i]
      } else {
        return buf.readUInt16BE(i * indexSize)
      }
    }

    var i;
    if (dir) {
      var foundIndex = -1;
      for (i = byteOffset; i < arrLength; i++) {
        if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
          if (foundIndex === -1) foundIndex = i;
          if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
        } else {
          if (foundIndex !== -1) i -= i - foundIndex;
          foundIndex = -1;
        }
      }
    } else {
      if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
      for (i = byteOffset; i >= 0; i--) {
        var found = true;
        for (var j = 0; j < valLength; j++) {
          if (read(arr, i + j) !== read(val, j)) {
            found = false;
            break
          }
        }
        if (found) return i
      }
    }

    return -1
  }

  Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
    return this.indexOf(val, byteOffset, encoding) !== -1
  };

  Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
  };

  Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
  };

  function hexWrite (buf, string, offset, length) {
    offset = Number(offset) || 0;
    var remaining = buf.length - offset;
    if (!length) {
      length = remaining;
    } else {
      length = Number(length);
      if (length > remaining) {
        length = remaining;
      }
    }

    // must be an even number of digits
    var strLen = string.length;
    if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

    if (length > strLen / 2) {
      length = strLen / 2;
    }
    for (var i = 0; i < length; ++i) {
      var parsed = parseInt(string.substr(i * 2, 2), 16);
      if (isNaN(parsed)) return i
      buf[offset + i] = parsed;
    }
    return i
  }

  function utf8Write (buf, string, offset, length) {
    return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
  }

  function asciiWrite (buf, string, offset, length) {
    return blitBuffer(asciiToBytes(string), buf, offset, length)
  }

  function latin1Write (buf, string, offset, length) {
    return asciiWrite(buf, string, offset, length)
  }

  function base64Write (buf, string, offset, length) {
    return blitBuffer(base64ToBytes(string), buf, offset, length)
  }

  function ucs2Write (buf, string, offset, length) {
    return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
  }

  Buffer.prototype.write = function write (string, offset, length, encoding) {
    // Buffer#write(string)
    if (offset === undefined) {
      encoding = 'utf8';
      length = this.length;
      offset = 0;
    // Buffer#write(string, encoding)
    } else if (length === undefined && typeof offset === 'string') {
      encoding = offset;
      length = this.length;
      offset = 0;
    // Buffer#write(string, offset[, length][, encoding])
    } else if (isFinite(offset)) {
      offset = offset | 0;
      if (isFinite(length)) {
        length = length | 0;
        if (encoding === undefined) encoding = 'utf8';
      } else {
        encoding = length;
        length = undefined;
      }
    // legacy write(string, encoding, offset, length) - remove in v0.13
    } else {
      throw new Error(
        'Buffer.write(string, encoding, offset[, length]) is no longer supported'
      )
    }

    var remaining = this.length - offset;
    if (length === undefined || length > remaining) length = remaining;

    if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
      throw new RangeError('Attempt to write outside buffer bounds')
    }

    if (!encoding) encoding = 'utf8';

    var loweredCase = false;
    for (;;) {
      switch (encoding) {
        case 'hex':
          return hexWrite(this, string, offset, length)

        case 'utf8':
        case 'utf-8':
          return utf8Write(this, string, offset, length)

        case 'ascii':
          return asciiWrite(this, string, offset, length)

        case 'latin1':
        case 'binary':
          return latin1Write(this, string, offset, length)

        case 'base64':
          // Warning: maxLength not taken into account in base64Write
          return base64Write(this, string, offset, length)

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return ucs2Write(this, string, offset, length)

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
          encoding = ('' + encoding).toLowerCase();
          loweredCase = true;
      }
    }
  };

  Buffer.prototype.toJSON = function toJSON () {
    return {
      type: 'Buffer',
      data: Array.prototype.slice.call(this._arr || this, 0)
    }
  };

  function base64Slice (buf, start, end) {
    if (start === 0 && end === buf.length) {
      return fromByteArray(buf)
    } else {
      return fromByteArray(buf.slice(start, end))
    }
  }

  function utf8Slice (buf, start, end) {
    end = Math.min(buf.length, end);
    var res = [];

    var i = start;
    while (i < end) {
      var firstByte = buf[i];
      var codePoint = null;
      var bytesPerSequence = (firstByte > 0xEF) ? 4
        : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
        : 1;

      if (i + bytesPerSequence <= end) {
        var secondByte, thirdByte, fourthByte, tempCodePoint;

        switch (bytesPerSequence) {
          case 1:
            if (firstByte < 0x80) {
              codePoint = firstByte;
            }
            break
          case 2:
            secondByte = buf[i + 1];
            if ((secondByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
              if (tempCodePoint > 0x7F) {
                codePoint = tempCodePoint;
              }
            }
            break
          case 3:
            secondByte = buf[i + 1];
            thirdByte = buf[i + 2];
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
              if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                codePoint = tempCodePoint;
              }
            }
            break
          case 4:
            secondByte = buf[i + 1];
            thirdByte = buf[i + 2];
            fourthByte = buf[i + 3];
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
              if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                codePoint = tempCodePoint;
              }
            }
        }
      }

      if (codePoint === null) {
        // we did not generate a valid codePoint so insert a
        // replacement char (U+FFFD) and advance only 1 byte
        codePoint = 0xFFFD;
        bytesPerSequence = 1;
      } else if (codePoint > 0xFFFF) {
        // encode to utf16 (surrogate pair dance)
        codePoint -= 0x10000;
        res.push(codePoint >>> 10 & 0x3FF | 0xD800);
        codePoint = 0xDC00 | codePoint & 0x3FF;
      }

      res.push(codePoint);
      i += bytesPerSequence;
    }

    return decodeCodePointsArray(res)
  }

  // Based on http://stackoverflow.com/a/22747272/680742, the browser with
  // the lowest limit is Chrome, with 0x10000 args.
  // We go 1 magnitude less, for safety
  var MAX_ARGUMENTS_LENGTH = 0x1000;

  function decodeCodePointsArray (codePoints) {
    var len = codePoints.length;
    if (len <= MAX_ARGUMENTS_LENGTH) {
      return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
    }

    // Decode in chunks to avoid "call stack size exceeded".
    var res = '';
    var i = 0;
    while (i < len) {
      res += String.fromCharCode.apply(
        String,
        codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
      );
    }
    return res
  }

  function asciiSlice (buf, start, end) {
    var ret = '';
    end = Math.min(buf.length, end);

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i] & 0x7F);
    }
    return ret
  }

  function latin1Slice (buf, start, end) {
    var ret = '';
    end = Math.min(buf.length, end);

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i]);
    }
    return ret
  }

  function hexSlice (buf, start, end) {
    var len = buf.length;

    if (!start || start < 0) start = 0;
    if (!end || end < 0 || end > len) end = len;

    var out = '';
    for (var i = start; i < end; ++i) {
      out += toHex(buf[i]);
    }
    return out
  }

  function utf16leSlice (buf, start, end) {
    var bytes = buf.slice(start, end);
    var res = '';
    for (var i = 0; i < bytes.length; i += 2) {
      res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
    }
    return res
  }

  Buffer.prototype.slice = function slice (start, end) {
    var len = this.length;
    start = ~~start;
    end = end === undefined ? len : ~~end;

    if (start < 0) {
      start += len;
      if (start < 0) start = 0;
    } else if (start > len) {
      start = len;
    }

    if (end < 0) {
      end += len;
      if (end < 0) end = 0;
    } else if (end > len) {
      end = len;
    }

    if (end < start) end = start;

    var newBuf;
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      newBuf = this.subarray(start, end);
      newBuf.__proto__ = Buffer.prototype;
    } else {
      var sliceLen = end - start;
      newBuf = new Buffer(sliceLen, undefined);
      for (var i = 0; i < sliceLen; ++i) {
        newBuf[i] = this[i + start];
      }
    }

    return newBuf
  };

  /*
   * Need to make sure that buffer isn't trying to write out of bounds.
   */
  function checkOffset (offset, ext, length) {
    if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
    if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
  }

  Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) checkOffset(offset, byteLength, this.length);

    var val = this[offset];
    var mul = 1;
    var i = 0;
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul;
    }

    return val
  };

  Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) {
      checkOffset(offset, byteLength, this.length);
    }

    var val = this[offset + --byteLength];
    var mul = 1;
    while (byteLength > 0 && (mul *= 0x100)) {
      val += this[offset + --byteLength] * mul;
    }

    return val
  };

  Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length);
    return this[offset]
  };

  Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    return this[offset] | (this[offset + 1] << 8)
  };

  Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    return (this[offset] << 8) | this[offset + 1]
  };

  Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return ((this[offset]) |
        (this[offset + 1] << 8) |
        (this[offset + 2] << 16)) +
        (this[offset + 3] * 0x1000000)
  };

  Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
  };

  Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) checkOffset(offset, byteLength, this.length);

    var val = this[offset];
    var mul = 1;
    var i = 0;
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul;
    }
    mul *= 0x80;

    if (val >= mul) val -= Math.pow(2, 8 * byteLength);

    return val
  };

  Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) checkOffset(offset, byteLength, this.length);

    var i = byteLength;
    var mul = 1;
    var val = this[offset + --i];
    while (i > 0 && (mul *= 0x100)) {
      val += this[offset + --i] * mul;
    }
    mul *= 0x80;

    if (val >= mul) val -= Math.pow(2, 8 * byteLength);

    return val
  };

  Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length);
    if (!(this[offset] & 0x80)) return (this[offset])
    return ((0xff - this[offset] + 1) * -1)
  };

  Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    var val = this[offset] | (this[offset + 1] << 8);
    return (val & 0x8000) ? val | 0xFFFF0000 : val
  };

  Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    var val = this[offset + 1] | (this[offset] << 8);
    return (val & 0x8000) ? val | 0xFFFF0000 : val
  };

  Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
  };

  Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
  };

  Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);
    return read(this, offset, true, 23, 4)
  };

  Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);
    return read(this, offset, false, 23, 4)
  };

  Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length);
    return read(this, offset, true, 52, 8)
  };

  Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length);
    return read(this, offset, false, 52, 8)
  };

  function checkInt (buf, value, offset, ext, max, min) {
    if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
    if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
  }

  Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1;
      checkInt(this, value, offset, byteLength, maxBytes, 0);
    }

    var mul = 1;
    var i = 0;
    this[offset] = value & 0xFF;
    while (++i < byteLength && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xFF;
    }

    return offset + byteLength
  };

  Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1;
      checkInt(this, value, offset, byteLength, maxBytes, 0);
    }

    var i = byteLength - 1;
    var mul = 1;
    this[offset + i] = value & 0xFF;
    while (--i >= 0 && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xFF;
    }

    return offset + byteLength
  };

  Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
    if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
    this[offset] = (value & 0xff);
    return offset + 1
  };

  function objectWriteUInt16 (buf, value, offset, littleEndian) {
    if (value < 0) value = 0xffff + value + 1;
    for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
      buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
        (littleEndian ? i : 1 - i) * 8;
    }
  }

  Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff);
      this[offset + 1] = (value >>> 8);
    } else {
      objectWriteUInt16(this, value, offset, true);
    }
    return offset + 2
  };

  Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 8);
      this[offset + 1] = (value & 0xff);
    } else {
      objectWriteUInt16(this, value, offset, false);
    }
    return offset + 2
  };

  function objectWriteUInt32 (buf, value, offset, littleEndian) {
    if (value < 0) value = 0xffffffff + value + 1;
    for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
      buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
    }
  }

  Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset + 3] = (value >>> 24);
      this[offset + 2] = (value >>> 16);
      this[offset + 1] = (value >>> 8);
      this[offset] = (value & 0xff);
    } else {
      objectWriteUInt32(this, value, offset, true);
    }
    return offset + 4
  };

  Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 24);
      this[offset + 1] = (value >>> 16);
      this[offset + 2] = (value >>> 8);
      this[offset + 3] = (value & 0xff);
    } else {
      objectWriteUInt32(this, value, offset, false);
    }
    return offset + 4
  };

  Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) {
      var limit = Math.pow(2, 8 * byteLength - 1);

      checkInt(this, value, offset, byteLength, limit - 1, -limit);
    }

    var i = 0;
    var mul = 1;
    var sub = 0;
    this[offset] = value & 0xFF;
    while (++i < byteLength && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
        sub = 1;
      }
      this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
    }

    return offset + byteLength
  };

  Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) {
      var limit = Math.pow(2, 8 * byteLength - 1);

      checkInt(this, value, offset, byteLength, limit - 1, -limit);
    }

    var i = byteLength - 1;
    var mul = 1;
    var sub = 0;
    this[offset + i] = value & 0xFF;
    while (--i >= 0 && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
        sub = 1;
      }
      this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
    }

    return offset + byteLength
  };

  Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -128);
    if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
    if (value < 0) value = 0xff + value + 1;
    this[offset] = (value & 0xff);
    return offset + 1
  };

  Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -32768);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff);
      this[offset + 1] = (value >>> 8);
    } else {
      objectWriteUInt16(this, value, offset, true);
    }
    return offset + 2
  };

  Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -32768);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 8);
      this[offset + 1] = (value & 0xff);
    } else {
      objectWriteUInt16(this, value, offset, false);
    }
    return offset + 2
  };

  Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -2147483648);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff);
      this[offset + 1] = (value >>> 8);
      this[offset + 2] = (value >>> 16);
      this[offset + 3] = (value >>> 24);
    } else {
      objectWriteUInt32(this, value, offset, true);
    }
    return offset + 4
  };

  Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -2147483648);
    if (value < 0) value = 0xffffffff + value + 1;
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 24);
      this[offset + 1] = (value >>> 16);
      this[offset + 2] = (value >>> 8);
      this[offset + 3] = (value & 0xff);
    } else {
      objectWriteUInt32(this, value, offset, false);
    }
    return offset + 4
  };

  function checkIEEE754 (buf, value, offset, ext, max, min) {
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
    if (offset < 0) throw new RangeError('Index out of range')
  }

  function writeFloat (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 4);
    }
    write(buf, value, offset, littleEndian, 23, 4);
    return offset + 4
  }

  Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
    return writeFloat(this, value, offset, true, noAssert)
  };

  Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
    return writeFloat(this, value, offset, false, noAssert)
  };

  function writeDouble (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 8);
    }
    write(buf, value, offset, littleEndian, 52, 8);
    return offset + 8
  }

  Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
    return writeDouble(this, value, offset, true, noAssert)
  };

  Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
    return writeDouble(this, value, offset, false, noAssert)
  };

  // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
  Buffer.prototype.copy = function copy (target, targetStart, start, end) {
    if (!start) start = 0;
    if (!end && end !== 0) end = this.length;
    if (targetStart >= target.length) targetStart = target.length;
    if (!targetStart) targetStart = 0;
    if (end > 0 && end < start) end = start;

    // Copy 0 bytes; we're done
    if (end === start) return 0
    if (target.length === 0 || this.length === 0) return 0

    // Fatal error conditions
    if (targetStart < 0) {
      throw new RangeError('targetStart out of bounds')
    }
    if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
    if (end < 0) throw new RangeError('sourceEnd out of bounds')

    // Are we oob?
    if (end > this.length) end = this.length;
    if (target.length - targetStart < end - start) {
      end = target.length - targetStart + start;
    }

    var len = end - start;
    var i;

    if (this === target && start < targetStart && targetStart < end) {
      // descending copy from end
      for (i = len - 1; i >= 0; --i) {
        target[i + targetStart] = this[i + start];
      }
    } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
      // ascending copy from start
      for (i = 0; i < len; ++i) {
        target[i + targetStart] = this[i + start];
      }
    } else {
      Uint8Array.prototype.set.call(
        target,
        this.subarray(start, start + len),
        targetStart
      );
    }

    return len
  };

  // Usage:
  //    buffer.fill(number[, offset[, end]])
  //    buffer.fill(buffer[, offset[, end]])
  //    buffer.fill(string[, offset[, end]][, encoding])
  Buffer.prototype.fill = function fill (val, start, end, encoding) {
    // Handle string cases:
    if (typeof val === 'string') {
      if (typeof start === 'string') {
        encoding = start;
        start = 0;
        end = this.length;
      } else if (typeof end === 'string') {
        encoding = end;
        end = this.length;
      }
      if (val.length === 1) {
        var code = val.charCodeAt(0);
        if (code < 256) {
          val = code;
        }
      }
      if (encoding !== undefined && typeof encoding !== 'string') {
        throw new TypeError('encoding must be a string')
      }
      if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
        throw new TypeError('Unknown encoding: ' + encoding)
      }
    } else if (typeof val === 'number') {
      val = val & 255;
    }

    // Invalid ranges are not set to a default, so can range check early.
    if (start < 0 || this.length < start || this.length < end) {
      throw new RangeError('Out of range index')
    }

    if (end <= start) {
      return this
    }

    start = start >>> 0;
    end = end === undefined ? this.length : end >>> 0;

    if (!val) val = 0;

    var i;
    if (typeof val === 'number') {
      for (i = start; i < end; ++i) {
        this[i] = val;
      }
    } else {
      var bytes = internalIsBuffer(val)
        ? val
        : utf8ToBytes(new Buffer(val, encoding).toString());
      var len = bytes.length;
      for (i = 0; i < end - start; ++i) {
        this[i + start] = bytes[i % len];
      }
    }

    return this
  };

  // HELPER FUNCTIONS
  // ================

  var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

  function base64clean (str) {
    // Node strips out invalid characters like \n and \t from the string, base64-js does not
    str = stringtrim(str).replace(INVALID_BASE64_RE, '');
    // Node converts strings with length < 2 to ''
    if (str.length < 2) return ''
    // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
    while (str.length % 4 !== 0) {
      str = str + '=';
    }
    return str
  }

  function stringtrim (str) {
    if (str.trim) return str.trim()
    return str.replace(/^\s+|\s+$/g, '')
  }

  function toHex (n) {
    if (n < 16) return '0' + n.toString(16)
    return n.toString(16)
  }

  function utf8ToBytes (string, units) {
    units = units || Infinity;
    var codePoint;
    var length = string.length;
    var leadSurrogate = null;
    var bytes = [];

    for (var i = 0; i < length; ++i) {
      codePoint = string.charCodeAt(i);

      // is surrogate component
      if (codePoint > 0xD7FF && codePoint < 0xE000) {
        // last char was a lead
        if (!leadSurrogate) {
          // no lead yet
          if (codePoint > 0xDBFF) {
            // unexpected trail
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
            continue
          } else if (i + 1 === length) {
            // unpaired lead
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
            continue
          }

          // valid lead
          leadSurrogate = codePoint;

          continue
        }

        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          leadSurrogate = codePoint;
          continue
        }

        // valid surrogate pair
        codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
      } else if (leadSurrogate) {
        // valid bmp char, but last char was a lead
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
      }

      leadSurrogate = null;

      // encode utf8
      if (codePoint < 0x80) {
        if ((units -= 1) < 0) break
        bytes.push(codePoint);
      } else if (codePoint < 0x800) {
        if ((units -= 2) < 0) break
        bytes.push(
          codePoint >> 0x6 | 0xC0,
          codePoint & 0x3F | 0x80
        );
      } else if (codePoint < 0x10000) {
        if ((units -= 3) < 0) break
        bytes.push(
          codePoint >> 0xC | 0xE0,
          codePoint >> 0x6 & 0x3F | 0x80,
          codePoint & 0x3F | 0x80
        );
      } else if (codePoint < 0x110000) {
        if ((units -= 4) < 0) break
        bytes.push(
          codePoint >> 0x12 | 0xF0,
          codePoint >> 0xC & 0x3F | 0x80,
          codePoint >> 0x6 & 0x3F | 0x80,
          codePoint & 0x3F | 0x80
        );
      } else {
        throw new Error('Invalid code point')
      }
    }

    return bytes
  }

  function asciiToBytes (str) {
    var byteArray = [];
    for (var i = 0; i < str.length; ++i) {
      // Node's code seems to be doing this and not & 0x7F..
      byteArray.push(str.charCodeAt(i) & 0xFF);
    }
    return byteArray
  }

  function utf16leToBytes (str, units) {
    var c, hi, lo;
    var byteArray = [];
    for (var i = 0; i < str.length; ++i) {
      if ((units -= 2) < 0) break

      c = str.charCodeAt(i);
      hi = c >> 8;
      lo = c % 256;
      byteArray.push(lo);
      byteArray.push(hi);
    }

    return byteArray
  }


  function base64ToBytes (str) {
    return toByteArray(base64clean(str))
  }

  function blitBuffer (src, dst, offset, length) {
    for (var i = 0; i < length; ++i) {
      if ((i + offset >= dst.length) || (i >= src.length)) break
      dst[i + offset] = src[i];
    }
    return i
  }

  function isnan (val) {
    return val !== val // eslint-disable-line no-self-compare
  }


  // the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
  // The _isBuffer check is for Safari 5-7 support, because it's missing
  // Object.prototype.constructor. Remove this eventually
  function isBuffer$1(obj) {
    return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
  }

  function isFastBuffer (obj) {
    return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
  }

  // For Node v0.10 support. Remove this eventually.
  function isSlowBuffer (obj) {
    return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
  }

  var _polyfillNode_buffer = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Buffer: Buffer,
    INSPECT_MAX_BYTES: INSPECT_MAX_BYTES,
    SlowBuffer: SlowBuffer,
    isBuffer: isBuffer$1,
    kMaxLength: _kMaxLength
  });

  const t=(t,n=4294967295,e=79764919)=>{const r=new Int32Array(256);let o,s,i,c=n;for(o=0;o<256;o++){for(i=o<<24,s=8;s>0;--s)i=2147483648&i?i<<1^e:i<<1;r[o]=i;}for(o=0;o<t.length;o++)c=c<<8^r[255&(c>>24^t[o])];return c},e=(n,e=t)=>{const r=t=>new Uint8Array(t.length/2).map(((n,e)=>parseInt(t.substring(2*e,2*(e+1)),16))),o=t=>r(t)[0],s=new Map;[,8364,,8218,402,8222,8230,8224,8225,710,8240,352,8249,338,,381,,,8216,8217,8220,8221,8226,8211,8212,732,8482,353,8250,339,,382,376].forEach(((t,n)=>s.set(t,n)));const i=new Uint8Array(n.length);let c,a,l,f=false,g=0,h=42,p=n.length>13&&"dynEncode"===n.substring(0,9),u=0;p&&(u=11,a=o(n.substring(9,u)),a<=1&&(u+=2,h=o(n.substring(11,u))),1===a&&(u+=8,l=(t=>new DataView(r(t).buffer).getInt32(0,true))(n.substring(13,u))));const d=256-h;for(let t=u;t<n.length;t++)if(c=n.charCodeAt(t),61!==c||f){if(92===c&&t<n.length-5&&p){const e=n.charCodeAt(t+1);117!==e&&85!==e||(c=parseInt(n.substring(t+2,t+6),16),t+=5);}if(c>255){const t=s.get(c);t&&(c=t+127);}f&&(f=false,c-=64),i[g++]=c<h&&c>0?c+d:c-h;}else f=true;const m=i.subarray(0,g);if(p&&1===a){const t=e(m);if(t!==l){const n="Decode failed crc32 validation";throw console.error("`simple-yenc`\n",n+"\n","Expected: "+l+"; Got: "+t+"\n","Visit https://github.com/eshaz/simple-yenc for more information"),Error(n)}}return m};

  function WASMAudioDecoderCommon() {
    // setup static methods
    const uint8Array = Uint8Array;
    const float32Array = Float32Array;

    if (!WASMAudioDecoderCommon.modules) {
      Object.defineProperties(WASMAudioDecoderCommon, {
        modules: {
          value: new WeakMap(),
        },

        setModule: {
          value(Ref, module) {
            WASMAudioDecoderCommon.modules.set(Ref, Promise.resolve(module));
          },
        },

        getModule: {
          value(Ref, wasmString) {
            let module = WASMAudioDecoderCommon.modules.get(Ref);

            if (!module) {
              if (!wasmString) {
                wasmString = Ref.wasm;
                module = WASMAudioDecoderCommon.inflateDynEncodeString(
                  wasmString,
                ).then((data) => WebAssembly.compile(data));
              } else {
                module = WebAssembly.compile(e(wasmString));
              }

              WASMAudioDecoderCommon.modules.set(Ref, module);
            }

            return module;
          },
        },

        concatFloat32: {
          value(buffers, length) {
            let ret = new float32Array(length),
              i = 0,
              offset = 0;

            while (i < buffers.length) {
              ret.set(buffers[i], offset);
              offset += buffers[i++].length;
            }

            return ret;
          },
        },

        getDecodedAudio: {
          value: (errors, channelData, samplesDecoded, sampleRate, bitDepth) => ({
            errors,
            channelData,
            samplesDecoded,
            sampleRate,
            bitDepth,
          }),
        },

        getDecodedAudioMultiChannel: {
          value(
            errors,
            input,
            channelsDecoded,
            samplesDecoded,
            sampleRate,
            bitDepth,
          ) {
            let channelData = [],
              i,
              j;

            for (i = 0; i < channelsDecoded; i++) {
              const channel = [];
              for (j = 0; j < input.length; ) channel.push(input[j++][i] || []);
              channelData.push(
                WASMAudioDecoderCommon.concatFloat32(channel, samplesDecoded),
              );
            }

            return WASMAudioDecoderCommon.getDecodedAudio(
              errors,
              channelData,
              samplesDecoded,
              sampleRate,
              bitDepth,
            );
          },
        },

        /*
         ******************
         * Compression Code
         ******************
         */

        inflateDynEncodeString: {
          value(source) {
            source = e(source);

            return new Promise((resolve) => {
              // prettier-ignore
              const puffString = String.raw`dynEncode012804c7886d()((()>+*§§)§,§§§§)§+§§§)§+.-()(*)-+)(.7*§)i¸¸,3§(i¸¸,3/G+.¡*(,(,3+)2å:-),§H(P*DI*H(P*@I++hH)H*r,hH(H(P*<J,i)^*<H,H(P*4U((I-H(H*i0J,^*DH+H-H*I+H,I*4)33H(H*H)^*DH(H+H)^*@H+i§H)i§3æ*).§K(iHI/+§H,iHn,§H+i(H+i(rCJ0I,H*I-+hH,,hH(H-V)(i)J.H.W)(i)c)(H,i)I,H-i*I-4)33i(I.*hH(V)(H+n5(H(i*I-i(I,i)I.+hH,i*J+iHn,hi(I-i*I,+hH,H/H-c)(H,iFn,hi(I,+hH,H0n5-H*V)(J(,hH/H(i)J(H(V)(J(i)c)(H)H(i)H,c)(3H*i*I*H,i)I,4(3(-H(H,W)(H-I-H,i*I,4)3(3(3H,H-I1H+I,H.i)H1V)(J.i(v5(33H.-H(H,i(c)(H,i*I,4)333)-§i*I*+§H*iHn,hi73H,H(i)8(H+J+H)P*(H*V)(J-r,§H)P*,H.i)H+H,i)V)(-H*i*I*H+i)I+H-H.I.H,H-i)I,4)333Ã+)-§iø7i(^*(iü7I,*h+hH+iDn,h*hilI+i)I,+hH+,hH+iô7H,c)(i)H+i´8W)(H,I,H+i*I+4)-+hH(H)8*J-i(p5.*h*h*hH-i')u,hH(P*(J+,hH(P*0J,H(P*,n50H+H,H-b((3H(P*0i)I.4)3H-i¨*n5*H-iÅ*s,hi73H-i)J+V)&+I,H(H+V)æ,8(I.H(H*8*J-i(p51H-i)J+i¸7V)(H(H+iø7V)(8(J/H(P*0J+s,hi73H+H,H.J,I.H(P*(m5(H.H(P*,s5.+hH,m5*H(P*(J.H+H.H+H/U((b((H(H(P*0i)J+^*0H,i)I,4(3(3H(H.^*03H-i¨*o5)33i(73(3(3-H,H+i)c)(H,i*I,H+i)I+4)33i)I-3H-3!2)0§K(i2J,L(H,H(^*(H,H*^*4H,i(^*0H,i(^*DH,j(_*<H,H)P*(^*,H,H+P*(^*8*h*h+hH,i)8(I3i§I**h*h*h*h*h*h*hH,i*8(6+(),03H,j(_*@i*I-H,P*<J.i,J(H,P*8J/s50H,H.i+J0^*<i¦I*H.H,P*4J1J.U(*H.U((J2i')o5/H.U()I.H,H(^*<H0H1U((H.i0J.i§i0i')o5/H/H.H2J*H(J.q50H,P*0J/H*I-H,P*(J0,hH,P*,H-q,hi)I-423+hH*m5+H/H0H(H1U((b((H/i)I/H(i)I(H*i)I*4(3(3H,H.^*<H,H-^*04*3iØ1U((5+i(I(i¨7i1^*(i$6iè1^*(i°7iè6^*(i¬7iÈ6^*(+hH(iÈ*n,hiÈ*I(+hH(i¨,n,hi¨,I(+hH(iØ,n,hiØ,I(+hH(iè,o,hH,i-H(i0c)(H(i*I(4)33iè1i1H,i-iÈ*8)Bi(I(+hH(ido,hH,i-H(i-c)(H(i*I(4)33iÈ6iè6H,i-iF8)BiØ1i)b((41-H,i-H(i/c)(H(i*I(4)3(3(-H,i-H(i1c)(H(i*I(4)3(3(-H,i-H(i0c)(H(i*I(4)3(3(3H,H/^*0H,H(^*<3i(I*4*3H,H,i¸)^*TH,H,iø-^*PH,H,iX^*LH,H,i(^*HH,i-8(I(H,i-8(I-i¥I*H,i,8(I.H(iErH-iEr5)H(i©*I1H-i)I0i(i;H.i,J(i(H(i(rCJ(J*H*i;sCI*i¨1I-H(I/+hH/,hH,i-H-V)(i)H,i+8(c)(H/i)I/H-i*I-H*i)I*4)-H(i)i¨1I/+hH(H*o,hH,i-H/V)(i)i(c)(H/i*I/H(i)I(4)33i¤I*H,iø-H,i¸)H,i-i;8)5+H0H1I2i(I-+hH-H2p,hH,H,iP8*J*i(p5-H*i7u,hH,i-H-i)H*c)(H-i)I-4*3i(I/i+I.i+I(*h*h*hH*i86*(*)3H-m,hi£I*403H-i)H,W)-I/i*I(4)3i3I.i/I(3H2H,H(8(H.J(H-J.p,hi¢I*4.3H,i-H-i)I*+hH(,hH*H/c)(H*i*I*H(i)I(4)-H.I-4+3(3(33H,W)1m,hiI*4,3H,iø-H,i¸)H,i-H18)J(,hi¡I*H(i(p5,H1H,V)ú-H,V)ø-o5,3H,i(H,iXH,i-H1i)H08)J(,hi I*H(i(p5,H0H,V)H,V)o5,3H,H,iPH,iH8+I*4+3(3(3H,i$6i¬78+I*3H*H3m5(3i)I-H*i(r5)3H)H,P*0^*(H+H,P*<^*(H*I-3H,i2L(H-33Á)+(i¨03b+(,(-(.(/(0(1(2(3(5(7(9(;(?(C(G(K(S([(c(k({(((«(Ë(ë((*)(iø03O)()()()(*(*(*(*(+(+(+(+(,(,(,(,(-(-(-(-(i¨13M8(9(:(((0(/(1(.(2(-(3(,(4(+(5(*(6()(7(T7*S7US0U `;

              WASMAudioDecoderCommon.getModule(WASMAudioDecoderCommon, puffString)
                .then((wasm) => WebAssembly.instantiate(wasm, {}))
                .then(({ exports }) => {
                  // required for minifiers that mangle the __heap_base property
                  const instanceExports = new Map(Object.entries(exports));

                  const puff = instanceExports.get("puff");
                  const memory = instanceExports.get("memory")["buffer"];
                  const dataArray = new uint8Array(memory);
                  const heapView = new DataView(memory);

                  let heapPos = instanceExports.get("__heap_base");

                  // source length
                  const sourceLength = source.length;
                  const sourceLengthPtr = heapPos;
                  heapPos += 4;
                  heapView.setInt32(sourceLengthPtr, sourceLength, true);

                  // source data
                  const sourcePtr = heapPos;
                  heapPos += sourceLength;
                  dataArray.set(source, sourcePtr);

                  // destination length
                  const destLengthPtr = heapPos;
                  heapPos += 4;
                  heapView.setInt32(
                    destLengthPtr,
                    dataArray.byteLength - heapPos,
                    true,
                  );

                  // destination data fills in the rest of the heap
                  puff(heapPos, destLengthPtr, sourcePtr, sourceLengthPtr);

                  resolve(
                    dataArray.slice(
                      heapPos,
                      heapPos + heapView.getInt32(destLengthPtr, true),
                    ),
                  );
                });
            });
          },
        },
      });
    }

    Object.defineProperty(this, "wasm", {
      enumerable: true,
      get: () => this._wasm,
    });

    this.getOutputChannels = (outputData, channelsDecoded, samplesDecoded) => {
      let output = [],
        i = 0;

      while (i < channelsDecoded)
        output.push(
          outputData.slice(
            i * samplesDecoded,
            i++ * samplesDecoded + samplesDecoded,
          ),
        );

      return output;
    };

    this.allocateTypedArray = (len, TypedArray, setPointer = true) => {
      const ptr = this._wasm.malloc(TypedArray.BYTES_PER_ELEMENT * len);
      if (setPointer) this._pointers.add(ptr);

      return {
        ptr: ptr,
        len: len,
        buf: new TypedArray(this._wasm.HEAP, ptr, len),
      };
    };

    this.free = () => {
      this._pointers.forEach((ptr) => {
        this._wasm.free(ptr);
      });
      this._pointers.clear();
    };

    this.codeToString = (ptr) => {
      const characters = [],
        heap = new Uint8Array(this._wasm.HEAP);
      for (let character = heap[ptr]; character !== 0; character = heap[++ptr])
        characters.push(character);

      return String.fromCharCode.apply(null, characters);
    };

    this.addError = (
      errors,
      message,
      frameLength,
      frameNumber,
      inputBytes,
      outputSamples,
    ) => {
      errors.push({
        message: message,
        frameLength: frameLength,
        frameNumber: frameNumber,
        inputBytes: inputBytes,
        outputSamples: outputSamples,
      });
    };

    this.instantiate = (_EmscriptenWASM, _module) => {
      if (_module) WASMAudioDecoderCommon.setModule(_EmscriptenWASM, _module);
      this._wasm = new _EmscriptenWASM(WASMAudioDecoderCommon).instantiate();
      this._pointers = new Set();

      return this._wasm.ready.then(() => this);
    };
  }

  // shim for using process in browser
  // based off https://github.com/defunctzombie/node-process/blob/master/browser.js

  function defaultSetTimout() {
      throw new Error('setTimeout has not been defined');
  }
  function defaultClearTimeout () {
      throw new Error('clearTimeout has not been defined');
  }
  var cachedSetTimeout = defaultSetTimout;
  var cachedClearTimeout = defaultClearTimeout;
  if (typeof global$1.setTimeout === 'function') {
      cachedSetTimeout = setTimeout;
  }
  if (typeof global$1.clearTimeout === 'function') {
      cachedClearTimeout = clearTimeout;
  }

  function runTimeout(fun) {
      if (cachedSetTimeout === setTimeout) {
          //normal enviroments in sane situations
          return setTimeout(fun, 0);
      }
      // if setTimeout wasn't available but was latter defined
      if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
          cachedSetTimeout = setTimeout;
          return setTimeout(fun, 0);
      }
      try {
          // when when somebody has screwed with setTimeout but no I.E. maddness
          return cachedSetTimeout(fun, 0);
      } catch(e){
          try {
              // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
              return cachedSetTimeout.call(null, fun, 0);
          } catch(e){
              // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
              return cachedSetTimeout.call(this, fun, 0);
          }
      }


  }
  function runClearTimeout(marker) {
      if (cachedClearTimeout === clearTimeout) {
          //normal enviroments in sane situations
          return clearTimeout(marker);
      }
      // if clearTimeout wasn't available but was latter defined
      if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
          cachedClearTimeout = clearTimeout;
          return clearTimeout(marker);
      }
      try {
          // when when somebody has screwed with setTimeout but no I.E. maddness
          return cachedClearTimeout(marker);
      } catch (e){
          try {
              // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
              return cachedClearTimeout.call(null, marker);
          } catch (e){
              // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
              // Some versions of I.E. have different rules for clearTimeout vs setTimeout
              return cachedClearTimeout.call(this, marker);
          }
      }



  }
  var queue = [];
  var draining = false;
  var currentQueue;
  var queueIndex = -1;

  function cleanUpNextTick() {
      if (!draining || !currentQueue) {
          return;
      }
      draining = false;
      if (currentQueue.length) {
          queue = currentQueue.concat(queue);
      } else {
          queueIndex = -1;
      }
      if (queue.length) {
          drainQueue();
      }
  }

  function drainQueue() {
      if (draining) {
          return;
      }
      var timeout = runTimeout(cleanUpNextTick);
      draining = true;

      var len = queue.length;
      while(len) {
          currentQueue = queue;
          queue = [];
          while (++queueIndex < len) {
              if (currentQueue) {
                  currentQueue[queueIndex].run();
              }
          }
          queueIndex = -1;
          len = queue.length;
      }
      currentQueue = null;
      draining = false;
      runClearTimeout(timeout);
  }
  function nextTick(fun) {
      var args = new Array(arguments.length - 1);
      if (arguments.length > 1) {
          for (var i = 1; i < arguments.length; i++) {
              args[i - 1] = arguments[i];
          }
      }
      queue.push(new Item(fun, args));
      if (queue.length === 1 && !draining) {
          runTimeout(drainQueue);
      }
  }
  // v8 likes predictible objects
  function Item(fun, array) {
      this.fun = fun;
      this.array = array;
  }
  Item.prototype.run = function () {
      this.fun.apply(null, this.array);
  };
  var title = 'browser';
  var platform = 'browser';
  var browser$1 = true;
  var env = {};
  var argv = [];
  var version$1 = ''; // empty string to avoid regexp issues
  var versions = {};
  var release = {};
  var config = {};

  function noop() {}

  var on$1 = noop;
  var addListener = noop;
  var once = noop;
  var off$1 = noop;
  var removeListener = noop;
  var removeAllListeners = noop;
  var emit = noop;

  function binding$1(name) {
      throw new Error('process.binding is not supported');
  }

  function cwd () { return '/' }
  function chdir (dir) {
      throw new Error('process.chdir is not supported');
  }function umask() { return 0; }

  // from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
  var performance$1 = global$1.performance || {};
  var performanceNow =
    performance$1.now        ||
    performance$1.mozNow     ||
    performance$1.msNow      ||
    performance$1.oNow       ||
    performance$1.webkitNow  ||
    function(){ return (new Date()).getTime() };

  // generate timestamp or delta
  // see http://nodejs.org/api/process.html#process_process_hrtime
  function hrtime(previousTimestamp){
    var clocktime = performanceNow.call(performance$1)*1e-3;
    var seconds = Math.floor(clocktime);
    var nanoseconds = Math.floor((clocktime%1)*1e9);
    if (previousTimestamp) {
      seconds = seconds - previousTimestamp[0];
      nanoseconds = nanoseconds - previousTimestamp[1];
      if (nanoseconds<0) {
        seconds--;
        nanoseconds += 1e9;
      }
    }
    return [seconds,nanoseconds]
  }

  var startTime = new Date();
  function uptime() {
    var currentTime = new Date();
    var dif = currentTime - startTime;
    return dif / 1000;
  }

  var browser$1$1 = {
    nextTick: nextTick,
    title: title,
    browser: browser$1,
    env: env,
    argv: argv,
    version: version$1,
    versions: versions,
    on: on$1,
    addListener: addListener,
    once: once,
    off: off$1,
    removeListener: removeListener,
    removeAllListeners: removeAllListeners,
    emit: emit,
    binding: binding$1,
    cwd: cwd,
    chdir: chdir,
    umask: umask,
    hrtime: hrtime,
    platform: platform,
    release: release,
    config: config,
    uptime: uptime
  };

  function getDefaultExportFromCjs (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  function getAugmentedNamespace(n) {
    if (Object.prototype.hasOwnProperty.call(n, '__esModule')) return n;
    var f = n.default;
  	if (typeof f == "function") {
  		var a = function a () {
  			if (this instanceof a) {
          return Reflect.construct(f, arguments, this.constructor);
  			}
  			return f.apply(this, arguments);
  		};
  		a.prototype = f.prototype;
    } else a = {};
    Object.defineProperty(a, '__esModule', {value: true});
  	Object.keys(n).forEach(function (k) {
  		var d = Object.getOwnPropertyDescriptor(n, k);
  		Object.defineProperty(a, k, d.get ? d : {
  			enumerable: true,
  			get: function () {
  				return n[k];
  			}
  		});
  	});
  	return a;
  }

  /**
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var browser;
  var hasRequiredBrowser;

  function requireBrowser () {
  	if (hasRequiredBrowser) return browser;
  	hasRequiredBrowser = 1;
  	browser = Worker;
  	return browser;
  }

  var browserExports = requireBrowser();
  var NodeWorker = /*@__PURE__*/getDefaultExportFromCjs(browserExports);

  const getWorker = () => globalThis.Worker || NodeWorker;

  class WASMAudioDecoderWorker extends getWorker() {
    constructor(options, name, Decoder, EmscriptenWASM) {
      if (!WASMAudioDecoderCommon.modules) new WASMAudioDecoderCommon();

      let source = WASMAudioDecoderCommon.modules.get(Decoder);

      if (!source) {
        let type = "text/javascript",
          isNode,
          webworkerSourceCode =
            "'use strict';" +
            // dependencies need to be manually resolved when stringifying this function
            `(${((_Decoder, _WASMAudioDecoderCommon, _EmscriptenWASM) => {
            // We're in a Web Worker

            // setup Promise that will be resolved once the WebAssembly Module is received
            let decoder,
              moduleResolve,
              modulePromise = new Promise((resolve) => {
                moduleResolve = resolve;
              });

            self.onmessage = ({ data: { id, command, data } }) => {
              let messagePromise = modulePromise,
                messagePayload = { id },
                transferList;

              if (command === "init") {
                Object.defineProperties(_Decoder, {
                  WASMAudioDecoderCommon: { value: _WASMAudioDecoderCommon },
                  EmscriptenWASM: { value: _EmscriptenWASM },
                  module: { value: data.module },
                  isWebWorker: { value: true },
                });

                decoder = new _Decoder(data.options);
                moduleResolve();
              } else if (command === "free") {
                decoder.free();
              } else if (command === "ready") {
                messagePromise = messagePromise.then(() => decoder.ready);
              } else if (command === "reset") {
                messagePromise = messagePromise.then(() => decoder.reset());
              } else {
                // "decode":
                // "decodeFrame":
                // "decodeFrames":
                Object.assign(
                  messagePayload,
                  decoder[command](
                    // detach buffers
                    Array.isArray(data)
                      ? data.map((data) => new Uint8Array(data))
                      : new Uint8Array(data),
                  ),
                );
                // The "transferList" parameter transfers ownership of channel data to main thread,
                // which avoids copying memory.
                transferList = messagePayload.channelData
                  ? messagePayload.channelData.map((channel) => channel.buffer)
                  : [];
              }

              messagePromise.then(() =>
                self.postMessage(messagePayload, transferList),
              );
            };
          }).toString()})(${Decoder}, ${WASMAudioDecoderCommon}, ${EmscriptenWASM})`;

        try {
          isNode = typeof browser$1$1.versions.node !== "undefined";
        } catch {}

        source = isNode
          ? `data:${type};base64,${Buffer.from(webworkerSourceCode).toString(
            "base64",
          )}`
          : URL.createObjectURL(new Blob([webworkerSourceCode], { type }));

        WASMAudioDecoderCommon.modules.set(Decoder, source);
      }

      super(source, { name });

      this._id = Number.MIN_SAFE_INTEGER;
      this._enqueuedOperations = new Map();

      this.onmessage = ({ data }) => {
        const { id, ...rest } = data;
        this._enqueuedOperations.get(id)(rest);
        this._enqueuedOperations.delete(id);
      };

      new EmscriptenWASM(WASMAudioDecoderCommon).getModule().then((module) => {
        this.postToDecoder("init", { module, options });
      });
    }

    async postToDecoder(command, data) {
      return new Promise((resolve) => {
        this.postMessage({
          command,
          id: this._id,
          data,
        });

        this._enqueuedOperations.set(this._id++, resolve);
      });
    }

    get ready() {
      return this.postToDecoder("ready");
    }

    async free() {
      await this.postToDecoder("free").finally(() => {
        this.terminate();
      });
    }

    async reset() {
      await this.postToDecoder("reset");
    }
  }

  const assignNames = (Class, name) => {
    Object.defineProperty(Class, "name", { value: name });
  };

  const symbol = Symbol;

  // prettier-ignore
  /*
  [
    [
      "left, right",
      "left, right, center",
      "left, center, right",
      "center, left, right",
      "center"
    ],
    [
      "front left, front right",
      "front left, front right, front center",
      "front left, front center, front right",
      "front center, front left, front right",
      "front center"
    ],
    [
      "side left, side right",
      "side left, side right, side center",
      "side left, side center, side right",
      "side center, side left, side right",
      "side center"
    ],
    [
      "rear left, rear right",
      "rear left, rear right, rear center",
      "rear left, rear center, rear right",
      "rear center, rear left, rear right",
      "rear center"
    ]
  ]
  */

  const mappingJoin = ", ";

  const channelMappings = (() => {
    const front = "front";
    const side = "side";
    const rear = "rear";
    const left = "left";
    const center = "center";
    const right = "right";

    return ["", front + " ", side + " ", rear + " "].map((x) =>
      [
        [left, right],
        [left, right, center],
        [left, center, right],
        [center, left, right],
        [center],
      ].flatMap((y) => y.map((z) => x + z).join(mappingJoin)),
    );
  })();

  const lfe = "LFE";
  const monophonic = "monophonic (mono)";
  const stereo = "stereo";
  const surround = "surround";

  const getChannelMapping = (channelCount, ...mappings) =>
    `${
    [
      monophonic,
      stereo,
      `linear ${surround}`,
      "quadraphonic",
      `5.0 ${surround}`,
      `5.1 ${surround}`,
      `6.1 ${surround}`,
      `7.1 ${surround}`,
    ][channelCount - 1]
  } (${mappings.join(mappingJoin)})`;

  // prettier-ignore
  const vorbisOpusChannelMapping = [
    monophonic,
    getChannelMapping(2,channelMappings[0][0]),
    getChannelMapping(3,channelMappings[0][2]),
    getChannelMapping(4,channelMappings[1][0],channelMappings[3][0]),
    getChannelMapping(5,channelMappings[1][2],channelMappings[3][0]),
    getChannelMapping(6,channelMappings[1][2],channelMappings[3][0],lfe),
    getChannelMapping(7,channelMappings[1][2],channelMappings[2][0],channelMappings[3][4],lfe),
    getChannelMapping(8,channelMappings[1][2],channelMappings[2][0],channelMappings[3][0],lfe),
  ];

  // sampleRates
  const rate192000 = 192000;
  const rate176400 = 176400;
  const rate96000 = 96000;
  const rate88200 = 88200;
  const rate64000 = 64000;
  const rate48000 = 48000;
  const rate44100 = 44100;
  const rate32000 = 32000;
  const rate24000 = 24000;
  const rate22050 = 22050;
  const rate16000 = 16000;
  const rate12000 = 12000;
  const rate11025 = 11025;
  const rate8000 = 8000;
  const rate7350 = 7350;

  // header key constants
  const absoluteGranulePosition = "absoluteGranulePosition";
  const bandwidth = "bandwidth";
  const bitDepth = "bitDepth";
  const bitrate = "bitrate";
  const bitrateMaximum = bitrate + "Maximum";
  const bitrateMinimum = bitrate + "Minimum";
  const bitrateNominal = bitrate + "Nominal";
  const buffer = "buffer";
  const bufferFullness = buffer + "Fullness";
  const codec = "codec";
  const codecFrames$1 = codec + "Frames";
  const coupledStreamCount = "coupledStreamCount";
  const crc$1 = "crc";
  const crc16 = crc$1 + "16";
  const crc32$1 = crc$1 + "32";
  const data$1 = "data";
  const description = "description";
  const duration = "duration";
  const emphasis = "emphasis";
  const hasOpusPadding = "hasOpusPadding";
  const header$1 = "header";
  const isContinuedPacket = "isContinuedPacket";
  const isCopyrighted = "isCopyrighted";
  const isFirstPage = "isFirstPage";
  const isHome = "isHome";
  const isLastPage$1 = "isLastPage";
  const isOriginal = "isOriginal";
  const isPrivate = "isPrivate";
  const isVbr = "isVbr";
  const layer = "layer";
  const length = "length";
  const mode = "mode";
  const modeExtension = mode + "Extension";
  const mpeg = "mpeg";
  const mpegVersion = mpeg + "Version";
  const numberAACFrames = "numberAAC" + "Frames";
  const outputGain = "outputGain";
  const preSkip = "preSkip";
  const profile = "profile";
  const profileBits = symbol();
  const protection = "protection";
  const rawData = "rawData";
  const segments = "segments";
  const subarray = "subarray";
  const version = "version";
  const vorbis = "vorbis";
  const vorbisComments$1 = vorbis + "Comments";
  const vorbisSetup$1 = vorbis + "Setup";

  const block = "block";
  const blockingStrategy = block + "ingStrategy";
  const blockingStrategyBits = symbol();
  const blockSize = block + "Size";
  const blocksize0 = block + "size0";
  const blocksize1 = block + "size1";
  const blockSizeBits = symbol();

  const channel = "channel";
  const channelMappingFamily = channel + "MappingFamily";
  const channelMappingTable = channel + "MappingTable";
  const channelMode = channel + "Mode";
  const channelModeBits = symbol();
  const channels = channel + "s";

  const copyright = "copyright";
  const copyrightId = copyright + "Id";
  const copyrightIdStart = copyright + "IdStart";

  const frame = "frame";
  const frameCount = frame + "Count";
  const frameLength = frame + "Length";

  const Number$1 = "Number";
  const frameNumber = frame + Number$1;
  const framePadding = frame + "Padding";
  const frameSize = frame + "Size";

  const Rate = "Rate";
  const inputSampleRate = "inputSample" + Rate;

  const page = "page";
  const pageChecksum = page + "Checksum";
  const pageSegmentBytes = symbol();
  const pageSegmentTable = page + "SegmentTable";
  const pageSequenceNumber = page + "Sequence" + Number$1;

  const sample = "sample";
  const sampleNumber = sample + Number$1;
  const sampleRate = sample + Rate;
  const sampleRateBits = symbol();
  const samples = sample + "s";

  const stream = "stream";
  const streamCount = stream + "Count";
  const streamInfo = stream + "Info";
  const streamSerialNumber = stream + "Serial" + Number$1;
  const streamStructureVersion = stream + "StructureVersion";

  const total = "total";
  const totalBytesOut = total + "BytesOut";
  const totalDuration = total + "Duration";
  const totalSamples$1 = total + "Samples";

  // private methods
  const readRawData = symbol();
  const incrementRawData = symbol();
  const mapCodecFrameStats = symbol();
  const mapFrameStats = symbol();
  const logWarning = symbol();
  const logError$1 = symbol();
  const syncFrame = symbol();
  const fixedLengthFrameSync = symbol();
  const getHeader = symbol();
  const setHeader = symbol();
  const getFrame = symbol();
  const parseFrame = symbol();
  const parseOggPage = symbol();
  const checkCodecUpdate = symbol();
  const reset = symbol();
  const enable = symbol();
  const getHeaderFromUint8Array = symbol();
  const checkFrameFooterCrc16 = symbol();

  const uint8Array = Uint8Array;
  const dataView = DataView;

  const reserved = "reserved";
  const bad = "bad";
  const free = "free";
  const none = "none";
  const sixteenBitCRC = "16bit CRC";

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  const getCrcTable = (crcTable, crcInitialValueFunction, crcFunction) => {
    for (let byte = 0; byte < crcTable[length]; byte++) {
      let crc = crcInitialValueFunction(byte);

      for (let bit = 8; bit > 0; bit--) crc = crcFunction(crc);

      crcTable[byte] = crc;
    }
    return crcTable;
  };

  const crc8Table = getCrcTable(
    new uint8Array(256),
    (b) => b,
    (crc) => (crc & 0x80 ? 0x07 ^ (crc << 1) : crc << 1),
  );

  const flacCrc16Table = [
    getCrcTable(
      new Uint16Array(256),
      (b) => b << 8,
      (crc) => (crc << 1) ^ (crc & (1 << 15) ? 0x8005 : 0),
    ),
  ];

  const crc32Table = [
    getCrcTable(
      new Uint32Array(256),
      (b) => b,
      (crc) => (crc >>> 1) ^ ((crc & 1) * 0xedb88320),
    ),
  ];

  // build crc tables
  for (let i = 0; i < 15; i++) {
    flacCrc16Table.push(new Uint16Array(256));
    crc32Table.push(new Uint32Array(256));

    for (let j = 0; j <= 0xff; j++) {
      flacCrc16Table[i + 1][j] =
        flacCrc16Table[0][flacCrc16Table[i][j] >>> 8] ^
        (flacCrc16Table[i][j] << 8);

      crc32Table[i + 1][j] =
        (crc32Table[i][j] >>> 8) ^ crc32Table[0][crc32Table[i][j] & 0xff];
    }
  }

  const crc8 = (data) => {
    let crc = 0;
    const dataLength = data[length];

    for (let i = 0; i !== dataLength; i++) crc = crc8Table[crc ^ data[i]];

    return crc;
  };

  const flacCrc16 = (data) => {
    const dataLength = data[length];
    const crcChunkSize = dataLength - 16;
    let crc = 0;
    let i = 0;

    while (i <= crcChunkSize) {
      crc ^= (data[i++] << 8) | data[i++];
      crc =
        flacCrc16Table[15][crc >> 8] ^
        flacCrc16Table[14][crc & 0xff] ^
        flacCrc16Table[13][data[i++]] ^
        flacCrc16Table[12][data[i++]] ^
        flacCrc16Table[11][data[i++]] ^
        flacCrc16Table[10][data[i++]] ^
        flacCrc16Table[9][data[i++]] ^
        flacCrc16Table[8][data[i++]] ^
        flacCrc16Table[7][data[i++]] ^
        flacCrc16Table[6][data[i++]] ^
        flacCrc16Table[5][data[i++]] ^
        flacCrc16Table[4][data[i++]] ^
        flacCrc16Table[3][data[i++]] ^
        flacCrc16Table[2][data[i++]] ^
        flacCrc16Table[1][data[i++]] ^
        flacCrc16Table[0][data[i++]];
    }

    while (i !== dataLength)
      crc = ((crc & 0xff) << 8) ^ flacCrc16Table[0][(crc >> 8) ^ data[i++]];

    return crc;
  };

  const crc32Function = (data) => {
    const dataLength = data[length];
    const crcChunkSize = dataLength - 16;
    let crc = 0;
    let i = 0;

    while (i <= crcChunkSize)
      crc =
        crc32Table[15][(data[i++] ^ crc) & 0xff] ^
        crc32Table[14][(data[i++] ^ (crc >>> 8)) & 0xff] ^
        crc32Table[13][(data[i++] ^ (crc >>> 16)) & 0xff] ^
        crc32Table[12][data[i++] ^ (crc >>> 24)] ^
        crc32Table[11][data[i++]] ^
        crc32Table[10][data[i++]] ^
        crc32Table[9][data[i++]] ^
        crc32Table[8][data[i++]] ^
        crc32Table[7][data[i++]] ^
        crc32Table[6][data[i++]] ^
        crc32Table[5][data[i++]] ^
        crc32Table[4][data[i++]] ^
        crc32Table[3][data[i++]] ^
        crc32Table[2][data[i++]] ^
        crc32Table[1][data[i++]] ^
        crc32Table[0][data[i++]];

    while (i !== dataLength)
      crc = crc32Table[0][(crc ^ data[i++]) & 0xff] ^ (crc >>> 8);

    return crc ^ -1;
  };

  const concatBuffers = (...buffers) => {
    const buffer = new uint8Array(
      buffers.reduce((acc, buf) => acc + buf[length], 0),
    );

    buffers.reduce((offset, buf) => {
      buffer.set(buf, offset);
      return offset + buf[length];
    }, 0);

    return buffer;
  };

  const bytesToString = (bytes) => String.fromCharCode(...bytes);

  // prettier-ignore
  const reverseTable = [0x0,0x8,0x4,0xc,0x2,0xa,0x6,0xe,0x1,0x9,0x5,0xd,0x3,0xb,0x7,0xf];
  const reverse = (val) =>
    (reverseTable[val & 0b1111] << 4) | reverseTable[val >> 4];

  class BitReader {
    constructor(data) {
      this._data = data;
      this._pos = data[length] * 8;
    }

    set position(position) {
      this._pos = position;
    }

    get position() {
      return this._pos;
    }

    read(bits) {
      const byte = Math.floor(this._pos / 8);
      const bit = this._pos % 8;
      this._pos -= bits;

      const window =
        (reverse(this._data[byte - 1]) << 8) + reverse(this._data[byte]);

      return (window >> (7 - bit)) & 0xff;
    }
  }

  /**
   * @todo Old versions of Safari do not support BigInt
   */
  const readInt64le = (view, offset) => {
    try {
      return view.getBigInt64(offset, true);
    } catch {
      const sign = view.getUint8(offset + 7) & 0x80 ? -1 : 1;
      let firstPart = view.getUint32(offset, true);
      let secondPart = view.getUint32(offset + 4, true);

      if (sign === -1) {
        firstPart = ~firstPart + 1;
        secondPart = ~secondPart + 1;
      }

      if (secondPart > 0x000fffff) {
        console.warn("This platform does not support BigInt");
      }

      return sign * (firstPart + secondPart * 2 ** 32);
    }
  };

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class HeaderCache {
    constructor(onCodecHeader, onCodecUpdate) {
      this._onCodecHeader = onCodecHeader;
      this._onCodecUpdate = onCodecUpdate;
      this[reset]();
    }

    [enable]() {
      this._isEnabled = true;
    }

    [reset]() {
      this._headerCache = new Map();
      this._codecUpdateData = new WeakMap();
      this._codecHeaderSent = false;
      this._codecShouldUpdate = false;
      this._bitrate = null;
      this._isEnabled = false;
    }

    [checkCodecUpdate](bitrate, totalDuration) {
      if (this._onCodecUpdate) {
        if (this._bitrate !== bitrate) {
          this._bitrate = bitrate;
          this._codecShouldUpdate = true;
        }

        // only update if codec data is available
        const codecData = this._codecUpdateData.get(
          this._headerCache.get(this._currentHeader),
        );

        if (this._codecShouldUpdate && codecData) {
          this._onCodecUpdate(
            {
              bitrate,
              ...codecData,
            },
            totalDuration,
          );
        }

        this._codecShouldUpdate = false;
      }
    }

    [getHeader](key) {
      const header = this._headerCache.get(key);

      if (header) {
        this._updateCurrentHeader(key);
      }

      return header;
    }

    [setHeader](key, header, codecUpdateFields) {
      if (this._isEnabled) {
        if (!this._codecHeaderSent) {
          this._onCodecHeader({ ...header });
          this._codecHeaderSent = true;
        }
        this._updateCurrentHeader(key);

        this._headerCache.set(key, header);
        this._codecUpdateData.set(header, codecUpdateFields);
      }
    }

    _updateCurrentHeader(key) {
      if (this._onCodecUpdate && key !== this._currentHeader) {
        this._codecShouldUpdate = true;
        this._currentHeader = key;
      }
    }
  }

  const headerStore = new WeakMap();
  const frameStore = new WeakMap();

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  /**
   * @abstract
   * @description Abstract class containing methods for parsing codec frames
   */
  class Parser {
    constructor(codecParser, headerCache) {
      this._codecParser = codecParser;
      this._headerCache = headerCache;
    }

    *[syncFrame]() {
      let frameData;

      do {
        frameData = yield* this.Frame[getFrame](
          this._codecParser,
          this._headerCache,
          0,
        );
        if (frameData) return frameData;
        this._codecParser[incrementRawData](1); // increment to continue syncing
      } while (true);
    }

    /**
     * @description Searches for Frames within bytes containing a sequence of known codec frames.
     * @param {boolean} ignoreNextFrame Set to true to return frames even if the next frame may not exist at the expected location
     * @returns {Frame}
     */
    *[fixedLengthFrameSync](ignoreNextFrame) {
      let frameData = yield* this[syncFrame]();
      const frameLength = frameStore.get(frameData)[length];

      if (
        ignoreNextFrame ||
        this._codecParser._flushing ||
        // check if there is a frame right after this one
        (yield* this.Header[getHeader](
          this._codecParser,
          this._headerCache,
          frameLength,
        ))
      ) {
        this._headerCache[enable](); // start caching when synced

        this._codecParser[incrementRawData](frameLength); // increment to the next frame
        this._codecParser[mapFrameStats](frameData);
        return frameData;
      }

      this._codecParser[logWarning](
        `Missing ${frame} at ${frameLength} bytes from current position.`,
        `Dropping current ${frame} and trying again.`,
      );
      this._headerCache[reset](); // frame is invalid and must re-sync and clear cache
      this._codecParser[incrementRawData](1); // increment to invalidate the current frame
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  /**
   * @abstract
   */
  class Frame {
    constructor(headerValue, dataValue) {
      frameStore.set(this, { [header$1]: headerValue });

      this[data$1] = dataValue;
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class CodecFrame extends Frame {
    static *[getFrame](Header, Frame, codecParser, headerCache, readOffset) {
      const headerValue = yield* Header[getHeader](
        codecParser,
        headerCache,
        readOffset,
      );

      if (headerValue) {
        const frameLengthValue = headerStore.get(headerValue)[frameLength];
        const samplesValue = headerStore.get(headerValue)[samples];

        const frame = (yield* codecParser[readRawData](
          frameLengthValue,
          readOffset,
        ))[subarray](0, frameLengthValue);

        return new Frame(headerValue, frame, samplesValue);
      } else {
        return null;
      }
    }

    constructor(headerValue, dataValue, samplesValue) {
      super(headerValue, dataValue);

      this[header$1] = headerValue;
      this[samples] = samplesValue;
      this[duration] = (samplesValue / headerValue[sampleRate]) * 1000;
      this[frameNumber] = null;
      this[totalBytesOut] = null;
      this[totalSamples$1] = null;
      this[totalDuration] = null;

      frameStore.get(this)[length] = dataValue[length];
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  const unsynchronizationFlag = "unsynchronizationFlag";
  const extendedHeaderFlag = "extendedHeaderFlag";
  const experimentalFlag = "experimentalFlag";
  const footerPresent = "footerPresent";

  class ID3v2 {
    static *getID3v2Header(codecParser, headerCache, readOffset) {
      const headerLength = 10;
      const header = {};

      let data = yield* codecParser[readRawData](3, readOffset);
      // Byte (0-2 of 9)
      // ID3
      if (data[0] !== 0x49 || data[1] !== 0x44 || data[2] !== 0x33) return null;

      data = yield* codecParser[readRawData](headerLength, readOffset);

      // Byte (3-4 of 9)
      // * `BBBBBBBB|........`: Major version
      // * `........|BBBBBBBB`: Minor version
      header[version] = `id3v2.${data[3]}.${data[4]}`;

      // Byte (5 of 9)
      // * `....0000.: Zeros (flags not implemented yet)
      if (data[5] & 0b00001111) return null;

      // Byte (5 of 9)
      // * `CDEF0000`: Flags
      // * `C.......`: Unsynchronisation (indicates whether or not unsynchronisation is used)
      // * `.D......`: Extended header (indicates whether or not the header is followed by an extended header)
      // * `..E.....`: Experimental indicator (indicates whether or not the tag is in an experimental stage)
      // * `...F....`: Footer present (indicates that a footer is present at the very end of the tag)
      header[unsynchronizationFlag] = !!(data[5] & 0b10000000);
      header[extendedHeaderFlag] = !!(data[5] & 0b01000000);
      header[experimentalFlag] = !!(data[5] & 0b00100000);
      header[footerPresent] = !!(data[5] & 0b00010000);

      // Byte (6-9 of 9)
      // * `0.......|0.......|0.......|0.......`: Zeros
      if (
        data[6] & 0b10000000 ||
        data[7] & 0b10000000 ||
        data[8] & 0b10000000 ||
        data[9] & 0b10000000
      )
        return null;

      // Byte (6-9 of 9)
      // * `.FFFFFFF|.FFFFFFF|.FFFFFFF|.FFFFFFF`: Tag Length
      // The ID3v2 tag size is encoded with four bytes where the most significant bit (bit 7)
      // is set to zero in every byte, making a total of 28 bits. The zeroed bits are ignored,
      // so a 257 bytes long tag is represented as $00 00 02 01.
      const dataLength =
        (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9];

      header[length] = headerLength + dataLength;

      return new ID3v2(header);
    }

    constructor(header) {
      this[version] = header[version];
      this[unsynchronizationFlag] = header[unsynchronizationFlag];
      this[extendedHeaderFlag] = header[extendedHeaderFlag];
      this[experimentalFlag] = header[experimentalFlag];
      this[footerPresent] = header[footerPresent];
      this[length] = header[length];
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class CodecHeader {
    /**
     * @private
     */
    constructor(header) {
      headerStore.set(this, header);

      this[bitDepth] = header[bitDepth];
      this[bitrate] = null; // set during frame mapping
      this[channels] = header[channels];
      this[channelMode] = header[channelMode];
      this[sampleRate] = header[sampleRate];
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  // http://www.mp3-tech.org/programmer/frame_header.html

  const bitrateMatrix = {
    // bits | V1,L1 | V1,L2 | V1,L3 | V2,L1 | V2,L2 & L3
    0b00000000: [free, free, free, free, free],
    0b00010000: [32, 32, 32, 32, 8],
    // 0b00100000: [64,   48,  40,  48,  16,],
    // 0b00110000: [96,   56,  48,  56,  24,],
    // 0b01000000: [128,  64,  56,  64,  32,],
    // 0b01010000: [160,  80,  64,  80,  40,],
    // 0b01100000: [192,  96,  80,  96,  48,],
    // 0b01110000: [224, 112,  96, 112,  56,],
    // 0b10000000: [256, 128, 112, 128,  64,],
    // 0b10010000: [288, 160, 128, 144,  80,],
    // 0b10100000: [320, 192, 160, 160,  96,],
    // 0b10110000: [352, 224, 192, 176, 112,],
    // 0b11000000: [384, 256, 224, 192, 128,],
    // 0b11010000: [416, 320, 256, 224, 144,],
    // 0b11100000: [448, 384, 320, 256, 160,],
    0b11110000: [bad, bad, bad, bad, bad],
  };

  const calcBitrate = (idx, interval, intervalOffset) =>
    8 *
      (((idx + intervalOffset) % interval) + interval) *
      (1 << ((idx + intervalOffset) / interval)) -
    8 * interval * ((interval / 8) | 0);

  // generate bitrate matrix
  for (let i = 2; i < 15; i++)
    bitrateMatrix[i << 4] = [
      i * 32, //                V1,L1
      calcBitrate(i, 4, 0), //  V1,L2
      calcBitrate(i, 4, -1), // V1,L3
      calcBitrate(i, 8, 4), //  V2,L1
      calcBitrate(i, 8, 0), //  V2,L2 & L3
    ];

  const v1Layer1 = 0;
  const v1Layer2 = 1;
  const v1Layer3 = 2;
  const v2Layer1 = 3;
  const v2Layer23 = 4;

  const bands = "bands ";
  const to31 = " to 31";
  const layer12ModeExtensions = {
    0b00000000: bands + 4 + to31,
    0b00010000: bands + 8 + to31,
    0b00100000: bands + 12 + to31,
    0b00110000: bands + 16 + to31,
  };

  const bitrateIndex = "bitrateIndex";
  const v2 = "v2";
  const v1 = "v1";

  const intensityStereo = "Intensity stereo ";
  const msStereo = ", MS stereo ";
  const on = "on";
  const off = "off";
  const layer3ModeExtensions = {
    0b00000000: intensityStereo + off + msStereo + off,
    0b00010000: intensityStereo + on + msStereo + off,
    0b00100000: intensityStereo + off + msStereo + on,
    0b00110000: intensityStereo + on + msStereo + on,
  };

  const layersValues = {
    0b00000000: { [description]: reserved },
    0b00000010: {
      [description]: "Layer III",
      [framePadding]: 1,
      [modeExtension]: layer3ModeExtensions,
      [v1]: {
        [bitrateIndex]: v1Layer3,
        [samples]: 1152,
      },
      [v2]: {
        [bitrateIndex]: v2Layer23,
        [samples]: 576,
      },
    },
    0b00000100: {
      [description]: "Layer II",
      [framePadding]: 1,
      [modeExtension]: layer12ModeExtensions,
      [samples]: 1152,
      [v1]: {
        [bitrateIndex]: v1Layer2,
      },
      [v2]: {
        [bitrateIndex]: v2Layer23,
      },
    },
    0b00000110: {
      [description]: "Layer I",
      [framePadding]: 4,
      [modeExtension]: layer12ModeExtensions,
      [samples]: 384,
      [v1]: {
        [bitrateIndex]: v1Layer1,
      },
      [v2]: {
        [bitrateIndex]: v2Layer1,
      },
    },
  };

  const mpegVersionDescription = "MPEG Version ";
  const isoIec = "ISO/IEC ";
  const mpegVersions = {
    0b00000000: {
      [description]: `${mpegVersionDescription}2.5 (later extension of MPEG 2)`,
      [layer]: v2,
      [sampleRate]: {
        0b00000000: rate11025,
        0b00000100: rate12000,
        0b00001000: rate8000,
        0b00001100: reserved,
      },
    },
    0b00001000: { [description]: reserved },
    0b00010000: {
      [description]: `${mpegVersionDescription}2 (${isoIec}13818-3)`,
      [layer]: v2,
      [sampleRate]: {
        0b00000000: rate22050,
        0b00000100: rate24000,
        0b00001000: rate16000,
        0b00001100: reserved,
      },
    },
    0b00011000: {
      [description]: `${mpegVersionDescription}1 (${isoIec}11172-3)`,
      [layer]: v1,
      [sampleRate]: {
        0b00000000: rate44100,
        0b00000100: rate48000,
        0b00001000: rate32000,
        0b00001100: reserved,
      },
    },
    length,
  };

  const protectionValues$1 = {
    0b00000000: sixteenBitCRC,
    0b00000001: none,
  };

  const emphasisValues = {
    0b00000000: none,
    0b00000001: "50/15 ms",
    0b00000010: reserved,
    0b00000011: "CCIT J.17",
  };

  const channelModes = {
    0b00000000: { [channels]: 2, [description]: stereo },
    0b01000000: { [channels]: 2, [description]: "joint " + stereo },
    0b10000000: { [channels]: 2, [description]: "dual channel" },
    0b11000000: { [channels]: 1, [description]: monophonic },
  };

  class MPEGHeader extends CodecHeader {
    static *[getHeader](codecParser, headerCache, readOffset) {
      const header = {};

      // check for id3 header
      const id3v2Header = yield* ID3v2.getID3v2Header(
        codecParser,
        headerCache,
        readOffset,
      );

      if (id3v2Header) {
        // throw away the data. id3 parsing is not implemented yet.
        yield* codecParser[readRawData](id3v2Header[length], readOffset);
        codecParser[incrementRawData](id3v2Header[length]);
      }

      // Must be at least four bytes.
      const data = yield* codecParser[readRawData](4, readOffset);

      // Check header cache
      const key = bytesToString(data[subarray](0, 4));
      const cachedHeader = headerCache[getHeader](key);
      if (cachedHeader) return new MPEGHeader(cachedHeader);

      // Frame sync (all bits must be set): `11111111|111`:
      if (data[0] !== 0xff || data[1] < 0xe0) return null;

      // Byte (2 of 4)
      // * `111BBCCD`
      // * `...BB...`: MPEG Audio version ID
      // * `.....CC.`: Layer description
      // * `.......D`: Protection bit (0 - Protected by CRC (16bit CRC follows header), 1 = Not protected)

      // Mpeg version (1, 2, 2.5)
      const mpegVersionValues = mpegVersions[data[1] & 0b00011000];
      if (mpegVersionValues[description] === reserved) return null;

      // Layer (I, II, III)
      const layerBits = data[1] & 0b00000110;
      if (layersValues[layerBits][description] === reserved) return null;
      const layerValues = {
        ...layersValues[layerBits],
        ...layersValues[layerBits][mpegVersionValues[layer]],
      };

      header[mpegVersion] = mpegVersionValues[description];
      header[layer] = layerValues[description];
      header[samples] = layerValues[samples];
      header[protection] = protectionValues$1[data[1] & 0b00000001];

      header[length] = 4;

      // Byte (3 of 4)
      // * `EEEEFFGH`
      // * `EEEE....`: Bitrate index. 1111 is invalid, everything else is accepted
      // * `....FF..`: Sample rate
      // * `......G.`: Padding bit, 0=frame not padded, 1=frame padded
      // * `.......H`: Private bit.
      header[bitrate] =
        bitrateMatrix[data[2] & 0b11110000][layerValues[bitrateIndex]];
      if (header[bitrate] === bad) return null;

      header[sampleRate] = mpegVersionValues[sampleRate][data[2] & 0b00001100];
      if (header[sampleRate] === reserved) return null;

      header[framePadding] = data[2] & 0b00000010 && layerValues[framePadding];
      header[isPrivate] = !!(data[2] & 0b00000001);

      header[frameLength] = Math.floor(
        (125 * header[bitrate] * header[samples]) / header[sampleRate] +
          header[framePadding],
      );
      if (!header[frameLength]) return null;

      // Byte (4 of 4)
      // * `IIJJKLMM`
      // * `II......`: Channel mode
      // * `..JJ....`: Mode extension (only if joint stereo)
      // * `....K...`: Copyright
      // * `.....L..`: Original
      // * `......MM`: Emphasis
      const channelModeBits = data[3] & 0b11000000;
      header[channelMode] = channelModes[channelModeBits][description];
      header[channels] = channelModes[channelModeBits][channels];

      header[modeExtension] = layerValues[modeExtension][data[3] & 0b00110000];
      header[isCopyrighted] = !!(data[3] & 0b00001000);
      header[isOriginal] = !!(data[3] & 0b00000100);

      header[emphasis] = emphasisValues[data[3] & 0b00000011];
      if (header[emphasis] === reserved) return null;

      header[bitDepth] = 16;

      // set header cache
      {
        const { length, frameLength, samples, ...codecUpdateFields } = header;

        headerCache[setHeader](key, header, codecUpdateFields);
      }
      return new MPEGHeader(header);
    }

    /**
     * @private
     * Call MPEGHeader.getHeader(Array<Uint8>) to get instance
     */
    constructor(header) {
      super(header);

      this[bitrate] = header[bitrate];
      this[emphasis] = header[emphasis];
      this[framePadding] = header[framePadding];
      this[isCopyrighted] = header[isCopyrighted];
      this[isOriginal] = header[isOriginal];
      this[isPrivate] = header[isPrivate];
      this[layer] = header[layer];
      this[modeExtension] = header[modeExtension];
      this[mpegVersion] = header[mpegVersion];
      this[protection] = header[protection];
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class MPEGFrame extends CodecFrame {
    static *[getFrame](codecParser, headerCache, readOffset) {
      return yield* super[getFrame](
        MPEGHeader,
        MPEGFrame,
        codecParser,
        headerCache,
        readOffset,
      );
    }

    constructor(header, frame, samples) {
      super(header, frame, samples);
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class MPEGParser extends Parser {
    constructor(codecParser, headerCache, onCodec) {
      super(codecParser, headerCache);
      this.Frame = MPEGFrame;
      this.Header = MPEGHeader;

      onCodec(this[codec]);
    }

    get [codec]() {
      return mpeg;
    }

    *[parseFrame]() {
      return yield* this[fixedLengthFrameSync]();
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  const mpegVersionValues = {
    0b00000000: "MPEG-4",
    0b00001000: "MPEG-2",
  };

  const layerValues = {
    0b00000000: "valid",
    0b00000010: bad,
    0b00000100: bad,
    0b00000110: bad,
  };

  const protectionValues = {
    0b00000000: sixteenBitCRC,
    0b00000001: none,
  };

  const profileValues = {
    0b00000000: "AAC Main",
    0b01000000: "AAC LC (Low Complexity)",
    0b10000000: "AAC SSR (Scalable Sample Rate)",
    0b11000000: "AAC LTP (Long Term Prediction)",
  };

  const sampleRates = {
    0b00000000: rate96000,
    0b00000100: rate88200,
    0b00001000: rate64000,
    0b00001100: rate48000,
    0b00010000: rate44100,
    0b00010100: rate32000,
    0b00011000: rate24000,
    0b00011100: rate22050,
    0b00100000: rate16000,
    0b00100100: rate12000,
    0b00101000: rate11025,
    0b00101100: rate8000,
    0b00110000: rate7350,
    0b00110100: reserved,
    0b00111000: reserved,
    0b00111100: "frequency is written explicitly",
  };

  // prettier-ignore
  const channelModeValues = {
    0b000000000: { [channels]: 0, [description]: "Defined in AOT Specific Config" },
    /*
    'monophonic (mono)'
    'stereo (left, right)'
    'linear surround (front center, front left, front right)'
    'quadraphonic (front center, front left, front right, rear center)'
    '5.0 surround (front center, front left, front right, rear left, rear right)'
    '5.1 surround (front center, front left, front right, rear left, rear right, LFE)'
    '7.1 surround (front center, front left, front right, side left, side right, rear left, rear right, LFE)'
    */
    0b001000000: { [channels]: 1, [description]: monophonic },
    0b010000000: { [channels]: 2, [description]: getChannelMapping(2,channelMappings[0][0]) },
    0b011000000: { [channels]: 3, [description]: getChannelMapping(3,channelMappings[1][3]), },
    0b100000000: { [channels]: 4, [description]: getChannelMapping(4,channelMappings[1][3],channelMappings[3][4]), },
    0b101000000: { [channels]: 5, [description]: getChannelMapping(5,channelMappings[1][3],channelMappings[3][0]), },
    0b110000000: { [channels]: 6, [description]: getChannelMapping(6,channelMappings[1][3],channelMappings[3][0],lfe), },
    0b111000000: { [channels]: 8, [description]: getChannelMapping(8,channelMappings[1][3],channelMappings[2][0],channelMappings[3][0],lfe), },
  };

  class AACHeader extends CodecHeader {
    static *[getHeader](codecParser, headerCache, readOffset) {
      const header = {};

      // Must be at least seven bytes. Out of data
      const data = yield* codecParser[readRawData](7, readOffset);

      // Check header cache
      const key = bytesToString([
        data[0],
        data[1],
        data[2],
        (data[3] & 0b11111100) | (data[6] & 0b00000011), // frame length, buffer fullness varies so don't cache it
      ]);
      const cachedHeader = headerCache[getHeader](key);

      if (!cachedHeader) {
        // Frame sync (all bits must be set): `11111111|1111`:
        if (data[0] !== 0xff || data[1] < 0xf0) return null;

        // Byte (2 of 7)
        // * `1111BCCD`
        // * `....B...`: MPEG Version: 0 for MPEG-4, 1 for MPEG-2
        // * `.....CC.`: Layer: always 0
        // * `.......D`: protection absent, Warning, set to 1 if there is no CRC and 0 if there is CRC
        header[mpegVersion] = mpegVersionValues[data[1] & 0b00001000];

        header[layer] = layerValues[data[1] & 0b00000110];
        if (header[layer] === bad) return null;

        const protectionBit = data[1] & 0b00000001;
        header[protection] = protectionValues[protectionBit];
        header[length] = protectionBit ? 7 : 9;

        // Byte (3 of 7)
        // * `EEFFFFGH`
        // * `EE......`: profile, the MPEG-4 Audio Object Type minus 1
        // * `..FFFF..`: MPEG-4 Sampling Frequency Index (15 is forbidden)
        // * `......G.`: private bit, guaranteed never to be used by MPEG, set to 0 when encoding, ignore when decoding
        header[profileBits] = data[2] & 0b11000000;
        header[sampleRateBits] = data[2] & 0b00111100;
        const privateBit = data[2] & 0b00000010;

        header[profile] = profileValues[header[profileBits]];

        header[sampleRate] = sampleRates[header[sampleRateBits]];
        if (header[sampleRate] === reserved) return null;

        header[isPrivate] = !!privateBit;

        // Byte (3,4 of 7)
        // * `.......H|HH......`: MPEG-4 Channel Configuration (in the case of 0, the channel configuration is sent via an inband PCE)
        header[channelModeBits] = ((data[2] << 8) | data[3]) & 0b111000000;
        header[channelMode] =
          channelModeValues[header[channelModeBits]][description];
        header[channels] = channelModeValues[header[channelModeBits]][channels];

        // Byte (4 of 7)
        // * `HHIJKLMM`
        // * `..I.....`: originality, set to 0 when encoding, ignore when decoding
        // * `...J....`: home, set to 0 when encoding, ignore when decoding
        // * `....K...`: copyrighted id bit, the next bit of a centrally registered copyright identifier, set to 0 when encoding, ignore when decoding
        // * `.....L..`: copyright id start, signals that this frame's copyright id bit is the first bit of the copyright id, set to 0 when encoding, ignore when decoding
        header[isOriginal] = !!(data[3] & 0b00100000);
        header[isHome] = !!(data[3] & 0b00001000);
        header[copyrightId] = !!(data[3] & 0b00001000);
        header[copyrightIdStart] = !!(data[3] & 0b00000100);
        header[bitDepth] = 16;
        header[samples] = 1024;

        // Byte (7 of 7)
        // * `......PP` Number of AAC frames (RDBs) in ADTS frame minus 1, for maximum compatibility always use 1 AAC frame per ADTS frame
        header[numberAACFrames] = data[6] & 0b00000011;

        {
          const {
            length,
            channelModeBits,
            profileBits,
            sampleRateBits,
            frameLength,
            samples,
            numberAACFrames,
            ...codecUpdateFields
          } = header;
          headerCache[setHeader](key, header, codecUpdateFields);
        }
      } else {
        Object.assign(header, cachedHeader);
      }

      // Byte (4,5,6 of 7)
      // * `.......MM|MMMMMMMM|MMM.....`: frame length, this value must include 7 or 9 bytes of header length: FrameLength = (ProtectionAbsent == 1 ? 7 : 9) + size(AACFrame)
      header[frameLength] =
        ((data[3] << 11) | (data[4] << 3) | (data[5] >> 5)) & 0x1fff;
      if (!header[frameLength]) return null;

      // Byte (6,7 of 7)
      // * `...OOOOO|OOOOOO..`: Buffer fullness
      const bufferFullnessBits = ((data[5] << 6) | (data[6] >> 2)) & 0x7ff;
      header[bufferFullness] =
        bufferFullnessBits === 0x7ff ? "VBR" : bufferFullnessBits;

      return new AACHeader(header);
    }

    /**
     * @private
     * Call AACHeader.getHeader(Array<Uint8>) to get instance
     */
    constructor(header) {
      super(header);

      this[copyrightId] = header[copyrightId];
      this[copyrightIdStart] = header[copyrightIdStart];
      this[bufferFullness] = header[bufferFullness];
      this[isHome] = header[isHome];
      this[isOriginal] = header[isOriginal];
      this[isPrivate] = header[isPrivate];
      this[layer] = header[layer];
      this[length] = header[length];
      this[mpegVersion] = header[mpegVersion];
      this[numberAACFrames] = header[numberAACFrames];
      this[profile] = header[profile];
      this[protection] = header[protection];
    }

    get audioSpecificConfig() {
      // Audio Specific Configuration
      // * `000EEFFF|F0HHH000`:
      // * `000EE...|........`: Object Type (profileBit + 1)
      // * `.....FFF|F.......`: Sample Rate
      // * `........|.0HHH...`: Channel Configuration
      // * `........|.....0..`: Frame Length (1024)
      // * `........|......0.`: does not depend on core coder
      // * `........|.......0`: Not Extension
      const header = headerStore.get(this);

      const audioSpecificConfig =
        ((header[profileBits] + 0x40) << 5) |
        (header[sampleRateBits] << 5) |
        (header[channelModeBits] >> 3);

      const bytes = new uint8Array(2);
      new dataView(bytes[buffer]).setUint16(0, audioSpecificConfig, false);
      return bytes;
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class AACFrame extends CodecFrame {
    static *[getFrame](codecParser, headerCache, readOffset) {
      return yield* super[getFrame](
        AACHeader,
        AACFrame,
        codecParser,
        headerCache,
        readOffset,
      );
    }

    constructor(header, frame, samples) {
      super(header, frame, samples);
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class AACParser extends Parser {
    constructor(codecParser, headerCache, onCodec) {
      super(codecParser, headerCache);
      this.Frame = AACFrame;
      this.Header = AACHeader;

      onCodec(this[codec]);
    }

    get [codec]() {
      return "aac";
    }

    *[parseFrame]() {
      return yield* this[fixedLengthFrameSync]();
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class FLACFrame extends CodecFrame {
    static _getFrameFooterCrc16(data) {
      return (data[data[length] - 2] << 8) + data[data[length] - 1];
    }

    // check frame footer crc
    // https://xiph.org/flac/format.html#frame_footer
    static [checkFrameFooterCrc16](data) {
      const expectedCrc16 = FLACFrame._getFrameFooterCrc16(data);
      const actualCrc16 = flacCrc16(data[subarray](0, -2));

      return expectedCrc16 === actualCrc16;
    }

    constructor(data, header, streamInfoValue) {
      header[streamInfo] = streamInfoValue;
      header[crc16] = FLACFrame._getFrameFooterCrc16(data);

      super(header, data, headerStore.get(header)[samples]);
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  const getFromStreamInfo = "get from STREAMINFO metadata block";

  const blockingStrategyValues = {
    0b00000000: "Fixed",
    0b00000001: "Variable",
  };

  const blockSizeValues = {
    0b00000000: reserved,
    0b00010000: 192,
    // 0b00100000: 576,
    // 0b00110000: 1152,
    // 0b01000000: 2304,
    // 0b01010000: 4608,
    // 0b01100000: "8-bit (blocksize-1) from end of header",
    // 0b01110000: "16-bit (blocksize-1) from end of header",
    // 0b10000000: 256,
    // 0b10010000: 512,
    // 0b10100000: 1024,
    // 0b10110000: 2048,
    // 0b11000000: 4096,
    // 0b11010000: 8192,
    // 0b11100000: 16384,
    // 0b11110000: 32768,
  };
  for (let i = 2; i < 16; i++)
    blockSizeValues[i << 4] = i < 6 ? 576 * 2 ** (i - 2) : 2 ** i;

  const sampleRateValues = {
    0b00000000: getFromStreamInfo,
    0b00000001: rate88200,
    0b00000010: rate176400,
    0b00000011: rate192000,
    0b00000100: rate8000,
    0b00000101: rate16000,
    0b00000110: rate22050,
    0b00000111: rate24000,
    0b00001000: rate32000,
    0b00001001: rate44100,
    0b00001010: rate48000,
    0b00001011: rate96000,
    // 0b00001100: "8-bit sample rate (in kHz) from end of header",
    // 0b00001101: "16-bit sample rate (in Hz) from end of header",
    // 0b00001110: "16-bit sample rate (in tens of Hz) from end of header",
    0b00001111: bad,
  };

  /* prettier-ignore */
  const channelAssignments = {
    /*'
    'monophonic (mono)'
    'stereo (left, right)'
    'linear surround (left, right, center)'
    'quadraphonic (front left, front right, rear left, rear right)'
    '5.0 surround (front left, front right, front center, rear left, rear right)'
    '5.1 surround (front left, front right, front center, LFE, rear left, rear right)'
    '6.1 surround (front left, front right, front center, LFE, rear center, side left, side right)'
    '7.1 surround (front left, front right, front center, LFE, rear left, rear right, side left, side right)'
    */
    0b00000000: {[channels]: 1, [description]: monophonic},
    0b00010000: {[channels]: 2, [description]: getChannelMapping(2,channelMappings[0][0])},
    0b00100000: {[channels]: 3, [description]: getChannelMapping(3,channelMappings[0][1])},
    0b00110000: {[channels]: 4, [description]: getChannelMapping(4,channelMappings[1][0],channelMappings[3][0])},
    0b01000000: {[channels]: 5, [description]: getChannelMapping(5,channelMappings[1][1],channelMappings[3][0])},
    0b01010000: {[channels]: 6, [description]: getChannelMapping(6,channelMappings[1][1],lfe,channelMappings[3][0])},
    0b01100000: {[channels]: 7, [description]: getChannelMapping(7,channelMappings[1][1],lfe,channelMappings[3][4],channelMappings[2][0])},
    0b01110000: {[channels]: 8, [description]: getChannelMapping(8,channelMappings[1][1],lfe,channelMappings[3][0],channelMappings[2][0])},
    0b10000000: {[channels]: 2, [description]: `${stereo} (left, diff)`},
    0b10010000: {[channels]: 2, [description]: `${stereo} (diff, right)`},
    0b10100000: {[channels]: 2, [description]: `${stereo} (avg, diff)`},
    0b10110000: reserved,
    0b11000000: reserved,
    0b11010000: reserved,
    0b11100000: reserved,
    0b11110000: reserved,
  };

  const bitDepthValues = {
    0b00000000: getFromStreamInfo,
    0b00000010: 8,
    0b00000100: 12,
    0b00000110: reserved,
    0b00001000: 16,
    0b00001010: 20,
    0b00001100: 24,
    0b00001110: reserved,
  };

  class FLACHeader extends CodecHeader {
    // https://datatracker.ietf.org/doc/html/rfc3629#section-3
    //    Char. number range  |        UTF-8 octet sequence
    //    (hexadecimal)    |              (binary)
    // --------------------+---------------------------------------------
    // 0000 0000-0000 007F | 0xxxxxxx
    // 0000 0080-0000 07FF | 110xxxxx 10xxxxxx
    // 0000 0800-0000 FFFF | 1110xxxx 10xxxxxx 10xxxxxx
    // 0001 0000-0010 FFFF | 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
    static _decodeUTF8Int(data) {
      if (data[0] > 0xfe) {
        return null; // length byte must have at least one zero as the lsb
      }

      if (data[0] < 0x80) return { value: data[0], length: 1 };

      // get length by counting the number of msb that are set to 1
      let length = 1;
      for (let zeroMask = 0x40; zeroMask & data[0]; zeroMask >>= 1) length++;

      let idx = length - 1,
        value = 0,
        shift = 0;

      // sum together the encoded bits in bytes 2 to length
      // 1110xxxx 10[cccccc] 10[bbbbbb] 10[aaaaaa]
      //
      //    value = [cccccc] | [bbbbbb] | [aaaaaa]
      for (; idx > 0; shift += 6, idx--) {
        if ((data[idx] & 0xc0) !== 0x80) {
          return null; // each byte should have leading 10xxxxxx
        }
        value |= (data[idx] & 0x3f) << shift; // add the encoded bits
      }

      // read the final encoded bits in byte 1
      //     1110[dddd] 10[cccccc] 10[bbbbbb] 10[aaaaaa]
      //
      // value = [dddd] | [cccccc] | [bbbbbb] | [aaaaaa]
      value |= (data[idx] & (0x7f >> length)) << shift;

      return { value, length };
    }

    static [getHeaderFromUint8Array](data, headerCache) {
      const codecParserStub = {
        [readRawData]: function* () {
          return data;
        },
      };

      return FLACHeader[getHeader](codecParserStub, headerCache, 0).next().value;
    }

    static *[getHeader](codecParser, headerCache, readOffset) {
      // Must be at least 6 bytes.
      let data = yield* codecParser[readRawData](6, readOffset);

      // Bytes (1-2 of 6)
      // * `11111111|111110..`: Frame sync
      // * `........|......0.`: Reserved 0 - mandatory, 1 - reserved
      if (data[0] !== 0xff || !(data[1] === 0xf8 || data[1] === 0xf9)) {
        return null;
      }

      const header = {};

      // Check header cache
      const key = bytesToString(data[subarray](0, 4));
      const cachedHeader = headerCache[getHeader](key);

      if (!cachedHeader) {
        // Byte (2 of 6)
        // * `.......C`: Blocking strategy, 0 - fixed, 1 - variable
        header[blockingStrategyBits] = data[1] & 0b00000001;
        header[blockingStrategy] =
          blockingStrategyValues[header[blockingStrategyBits]];

        // Byte (3 of 6)
        // * `DDDD....`: Block size in inter-channel samples
        // * `....EEEE`: Sample rate
        header[blockSizeBits] = data[2] & 0b11110000;
        header[sampleRateBits] = data[2] & 0b00001111;

        header[blockSize] = blockSizeValues[header[blockSizeBits]];
        if (header[blockSize] === reserved) {
          return null;
        }

        header[sampleRate] = sampleRateValues[header[sampleRateBits]];
        if (header[sampleRate] === bad) {
          return null;
        }

        // Byte (4 of 6)
        // * `FFFF....`: Channel assignment
        // * `....GGG.`: Sample size in bits
        // * `.......H`: Reserved 0 - mandatory, 1 - reserved
        if (data[3] & 0b00000001) {
          return null;
        }

        const channelAssignment = channelAssignments[data[3] & 0b11110000];
        if (channelAssignment === reserved) {
          return null;
        }

        header[channels] = channelAssignment[channels];
        header[channelMode] = channelAssignment[description];

        header[bitDepth] = bitDepthValues[data[3] & 0b00001110];
        if (header[bitDepth] === reserved) {
          return null;
        }
      } else {
        Object.assign(header, cachedHeader);
      }

      // Byte (5...)
      // * `IIIIIIII|...`: VBR block size ? sample number : frame number
      header[length] = 5;

      // check if there is enough data to parse UTF8
      data = yield* codecParser[readRawData](header[length] + 8, readOffset);

      const decodedUtf8 = FLACHeader._decodeUTF8Int(data[subarray](4));
      if (!decodedUtf8) {
        return null;
      }

      if (header[blockingStrategyBits]) {
        header[sampleNumber] = decodedUtf8.value;
      } else {
        header[frameNumber] = decodedUtf8.value;
      }

      header[length] += decodedUtf8[length];

      // Byte (...)
      // * `JJJJJJJJ|(JJJJJJJJ)`: Blocksize (8/16bit custom value)
      if (header[blockSizeBits] === 0b01100000) {
        // 8 bit
        if (data[length] < header[length])
          data = yield* codecParser[readRawData](header[length], readOffset);

        header[blockSize] = data[header[length] - 1] + 1;
        header[length] += 1;
      } else if (header[blockSizeBits] === 0b01110000) {
        // 16 bit
        if (data[length] < header[length])
          data = yield* codecParser[readRawData](header[length], readOffset);

        header[blockSize] =
          (data[header[length] - 1] << 8) + data[header[length]] + 1;
        header[length] += 2;
      }

      header[samples] = header[blockSize];

      // Byte (...)
      // * `KKKKKKKK|(KKKKKKKK)`: Sample rate (8/16bit custom value)
      if (header[sampleRateBits] === 0b00001100) {
        // 8 bit
        if (data[length] < header[length])
          data = yield* codecParser[readRawData](header[length], readOffset);

        header[sampleRate] = data[header[length] - 1] * 1000;
        header[length] += 1;
      } else if (header[sampleRateBits] === 0b00001101) {
        // 16 bit
        if (data[length] < header[length])
          data = yield* codecParser[readRawData](header[length], readOffset);

        header[sampleRate] =
          (data[header[length] - 1] << 8) + data[header[length]];
        header[length] += 2;
      } else if (header[sampleRateBits] === 0b00001110) {
        // 16 bit
        if (data[length] < header[length])
          data = yield* codecParser[readRawData](header[length], readOffset);

        header[sampleRate] =
          ((data[header[length] - 1] << 8) + data[header[length]]) * 10;
        header[length] += 2;
      }

      // Byte (...)
      // * `LLLLLLLL`: CRC-8
      if (data[length] < header[length])
        data = yield* codecParser[readRawData](header[length], readOffset);

      header[crc$1] = data[header[length] - 1];
      if (header[crc$1] !== crc8(data[subarray](0, header[length] - 1))) {
        return null;
      }

      {
        if (!cachedHeader) {
          const {
            blockingStrategyBits,
            frameNumber,
            sampleNumber,
            samples,
            sampleRateBits,
            blockSizeBits,
            crc,
            length,
            ...codecUpdateFields
          } = header;
          headerCache[setHeader](key, header, codecUpdateFields);
        }
      }
      return new FLACHeader(header);
    }

    /**
     * @private
     * Call FLACHeader.getHeader(Array<Uint8>) to get instance
     */
    constructor(header) {
      super(header);

      this[crc16] = null; // set in FLACFrame
      this[blockingStrategy] = header[blockingStrategy];
      this[blockSize] = header[blockSize];
      this[frameNumber] = header[frameNumber];
      this[sampleNumber] = header[sampleNumber];
      this[streamInfo] = null; // set during ogg parsing
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  const MIN_FLAC_FRAME_SIZE = 2;
  const MAX_FLAC_FRAME_SIZE = 512 * 1024;

  class FLACParser extends Parser {
    constructor(codecParser, headerCache, onCodec) {
      super(codecParser, headerCache);
      this.Frame = FLACFrame;
      this.Header = FLACHeader;

      onCodec(this[codec]);
    }

    get [codec]() {
      return "flac";
    }

    *_getNextFrameSyncOffset(offset) {
      const data = yield* this._codecParser[readRawData](2, 0);
      const dataLength = data[length] - 2;

      while (offset < dataLength) {
        // * `11111111|111110..`: Frame sync
        // * `........|......0.`: Reserved 0 - mandatory, 1 - reserved
        const firstByte = data[offset];
        if (firstByte === 0xff) {
          const secondByte = data[offset + 1];
          if (secondByte === 0xf8 || secondByte === 0xf9) break;
          if (secondByte !== 0xff) offset++; // might as well check for the next sync byte
        }
        offset++;
      }

      return offset;
    }

    *[parseFrame]() {
      // find the first valid frame header
      do {
        const header = yield* FLACHeader[getHeader](
          this._codecParser,
          this._headerCache,
          0,
        );

        if (header) {
          // found a valid frame header
          // find the next valid frame header
          let nextHeaderOffset =
            headerStore.get(header)[length] + MIN_FLAC_FRAME_SIZE;

          while (nextHeaderOffset <= MAX_FLAC_FRAME_SIZE) {
            if (
              this._codecParser._flushing ||
              (yield* FLACHeader[getHeader](
                this._codecParser,
                this._headerCache,
                nextHeaderOffset,
              ))
            ) {
              // found a valid next frame header
              let frameData =
                yield* this._codecParser[readRawData](nextHeaderOffset);

              if (!this._codecParser._flushing)
                frameData = frameData[subarray](0, nextHeaderOffset);

              // check that this is actually the next header by validating the frame footer crc16
              if (FLACFrame[checkFrameFooterCrc16](frameData)) {
                // both frame headers, and frame footer crc16 are valid, we are synced (odds are pretty low of a false positive)
                const frame = new FLACFrame(frameData, header);

                this._headerCache[enable](); // start caching when synced
                this._codecParser[incrementRawData](nextHeaderOffset); // increment to the next frame
                this._codecParser[mapFrameStats](frame);

                return frame;
              }
            }

            nextHeaderOffset = yield* this._getNextFrameSyncOffset(
              nextHeaderOffset + 1,
            );
          }

          this._codecParser[logWarning](
            `Unable to sync FLAC frame after searching ${nextHeaderOffset} bytes.`,
          );
          this._codecParser[incrementRawData](nextHeaderOffset);
        } else {
          // not synced, increment data to continue syncing
          this._codecParser[incrementRawData](
            yield* this._getNextFrameSyncOffset(1),
          );
        }
      } while (true);
    }

    [parseOggPage](oggPage) {
      if (oggPage[pageSequenceNumber] === 0) {
        // Identification header

        this._headerCache[enable]();
        this._streamInfo = oggPage[data$1][subarray](13);
      } else if (oggPage[pageSequenceNumber] === 1) ; else {
        oggPage[codecFrames$1] = frameStore
          .get(oggPage)
          [segments].map((segment) => {
            const header = FLACHeader[getHeaderFromUint8Array](
              segment,
              this._headerCache,
            );

            if (header) {
              return new FLACFrame(segment, header, this._streamInfo);
            } else {
              this._codecParser[logWarning](
                "Failed to parse Ogg FLAC frame",
                "Skipping invalid FLAC frame",
              );
            }
          })
          .filter((frame) => !!frame);
      }

      return oggPage;
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class OggPageHeader {
    static *[getHeader](codecParser, headerCache, readOffset) {
      const header = {};

      // Must be at least 28 bytes.
      let data = yield* codecParser[readRawData](28, readOffset);

      // Bytes (1-4 of 28)
      // Frame sync (must equal OggS): `AAAAAAAA|AAAAAAAA|AAAAAAAA|AAAAAAAA`:
      if (
        data[0] !== 0x4f || // O
        data[1] !== 0x67 || // g
        data[2] !== 0x67 || // g
        data[3] !== 0x53 //    S
      ) {
        return null;
      }

      // Byte (5 of 28)
      // * `BBBBBBBB`: stream_structure_version
      header[streamStructureVersion] = data[4];

      // Byte (6 of 28)
      // * `00000CDE`
      // * `00000...`: All zeros
      // * `.....C..`: (0 no, 1 yes) last page of logical bitstream (eos)
      // * `......D.`: (0 no, 1 yes) first page of logical bitstream (bos)
      // * `.......E`: (0 no, 1 yes) continued packet
      const zeros = data[5] & 0b11111000;
      if (zeros) return null;

      header[isLastPage$1] = !!(data[5] & 0b00000100);
      header[isFirstPage] = !!(data[5] & 0b00000010);
      header[isContinuedPacket] = !!(data[5] & 0b00000001);

      const view = new dataView(uint8Array.from(data[subarray](0, 28))[buffer]);

      // Byte (7-14 of 28)
      // * `FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF`
      // * Absolute Granule Position
      header[absoluteGranulePosition] = readInt64le(view, 6);

      // Byte (15-18 of 28)
      // * `GGGGGGGG|GGGGGGGG|GGGGGGGG|GGGGGGGG`
      // * Stream Serial Number
      header[streamSerialNumber] = view.getInt32(14, true);

      // Byte (19-22 of 28)
      // * `HHHHHHHH|HHHHHHHH|HHHHHHHH|HHHHHHHH`
      // * Page Sequence Number
      header[pageSequenceNumber] = view.getInt32(18, true);

      // Byte (23-26 of 28)
      // * `IIIIIIII|IIIIIIII|IIIIIIII|IIIIIIII`
      // * Page Checksum
      header[pageChecksum] = view.getInt32(22, true);

      // Byte (27 of 28)
      // * `JJJJJJJJ`: Number of page segments in the segment table
      const pageSegmentTableLength = data[26];
      header[length] = pageSegmentTableLength + 27;

      data = yield* codecParser[readRawData](header[length], readOffset); // read in the page segment table

      header[frameLength] = 0;
      header[pageSegmentTable] = [];
      header[pageSegmentBytes] = uint8Array.from(
        data[subarray](27, header[length]),
      );

      for (let i = 0, segmentLength = 0; i < pageSegmentTableLength; i++) {
        const segmentByte = header[pageSegmentBytes][i];

        header[frameLength] += segmentByte;
        segmentLength += segmentByte;

        if (segmentByte !== 0xff || i === pageSegmentTableLength - 1) {
          header[pageSegmentTable].push(segmentLength);
          segmentLength = 0;
        }
      }

      return new OggPageHeader(header);
    }

    /**
     * @private
     * Call OggPageHeader.getHeader(Array<Uint8>) to get instance
     */
    constructor(header) {
      headerStore.set(this, header);

      this[absoluteGranulePosition] = header[absoluteGranulePosition];
      this[isContinuedPacket] = header[isContinuedPacket];
      this[isFirstPage] = header[isFirstPage];
      this[isLastPage$1] = header[isLastPage$1];
      this[pageSegmentTable] = header[pageSegmentTable];
      this[pageSequenceNumber] = header[pageSequenceNumber];
      this[pageChecksum] = header[pageChecksum];
      this[streamSerialNumber] = header[streamSerialNumber];
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class OggPage extends Frame {
    static *[getFrame](codecParser, headerCache, readOffset) {
      const header = yield* OggPageHeader[getHeader](
        codecParser,
        headerCache,
        readOffset,
      );

      if (header) {
        const frameLengthValue = headerStore.get(header)[frameLength];
        const headerLength = headerStore.get(header)[length];
        const totalLength = headerLength + frameLengthValue;

        const rawDataValue = (yield* codecParser[readRawData](totalLength, 0))[
          subarray
        ](0, totalLength);

        const frame = rawDataValue[subarray](headerLength, totalLength);

        return new OggPage(header, frame, rawDataValue);
      } else {
        return null;
      }
    }

    constructor(header, frame, rawDataValue) {
      super(header, frame);

      frameStore.get(this)[length] = rawDataValue[length];

      this[codecFrames$1] = [];
      this[rawData] = rawDataValue;
      this[absoluteGranulePosition] = header[absoluteGranulePosition];
      this[crc32$1] = header[pageChecksum];
      this[duration] = 0;
      this[isContinuedPacket] = header[isContinuedPacket];
      this[isFirstPage] = header[isFirstPage];
      this[isLastPage$1] = header[isLastPage$1];
      this[pageSequenceNumber] = header[pageSequenceNumber];
      this[samples] = 0;
      this[streamSerialNumber] = header[streamSerialNumber];
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class OpusFrame extends CodecFrame {
    constructor(data, header, samples) {
      super(header, data, samples);
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  /* prettier-ignore */
  const channelMappingFamilies = {
    0b00000000: vorbisOpusChannelMapping.slice(0,2),
      /*
      0: "monophonic (mono)"
      1: "stereo (left, right)"
      */
    0b00000001: vorbisOpusChannelMapping
      /*
      0: "monophonic (mono)"
      1: "stereo (left, right)"
      2: "linear surround (left, center, right)"
      3: "quadraphonic (front left, front right, rear left, rear right)"
      4: "5.0 surround (front left, front center, front right, rear left, rear right)"
      5: "5.1 surround (front left, front center, front right, rear left, rear right, LFE)"
      6: "6.1 surround (front left, front center, front right, side left, side right, rear center, LFE)"
      7: "7.1 surround (front left, front center, front right, side left, side right, rear left, rear right, LFE)"
      */
    // additional channel mappings are user defined
  };

  const silkOnly = "SILK-only";
  const celtOnly = "CELT-only";
  const hybrid = "Hybrid";

  const narrowBand = "narrowband";
  const mediumBand = "medium-band";
  const wideBand = "wideband";
  const superWideBand = "super-wideband";
  const fullBand = "fullband";

  //  0 1 2 3 4 5 6 7
  // +-+-+-+-+-+-+-+-+
  // | config  |s| c |
  // +-+-+-+-+-+-+-+-+
  // prettier-ignore
  const configTable = {
    0b00000000: { [mode]: silkOnly, [bandwidth]: narrowBand, [frameSize]: 10 },
    0b00001000: { [mode]: silkOnly, [bandwidth]: narrowBand, [frameSize]: 20 },
    0b00010000: { [mode]: silkOnly, [bandwidth]: narrowBand, [frameSize]: 40 },
    0b00011000: { [mode]: silkOnly, [bandwidth]: narrowBand, [frameSize]: 60 },
    0b00100000: { [mode]: silkOnly, [bandwidth]: mediumBand, [frameSize]: 10 },
    0b00101000: { [mode]: silkOnly, [bandwidth]: mediumBand, [frameSize]: 20 },
    0b00110000: { [mode]: silkOnly, [bandwidth]: mediumBand, [frameSize]: 40 },
    0b00111000: { [mode]: silkOnly, [bandwidth]: mediumBand, [frameSize]: 60 },
    0b01000000: { [mode]: silkOnly, [bandwidth]: wideBand, [frameSize]: 10 },
    0b01001000: { [mode]: silkOnly, [bandwidth]: wideBand, [frameSize]: 20 },
    0b01010000: { [mode]: silkOnly, [bandwidth]: wideBand, [frameSize]: 40 },
    0b01011000: { [mode]: silkOnly, [bandwidth]: wideBand, [frameSize]: 60 },
    0b01100000: { [mode]: hybrid, [bandwidth]: superWideBand, [frameSize]: 10 },
    0b01101000: { [mode]: hybrid, [bandwidth]: superWideBand, [frameSize]: 20 },
    0b01110000: { [mode]: hybrid, [bandwidth]: fullBand, [frameSize]: 10 },
    0b01111000: { [mode]: hybrid, [bandwidth]: fullBand, [frameSize]: 20 },
    0b10000000: { [mode]: celtOnly, [bandwidth]: narrowBand, [frameSize]: 2.5 },
    0b10001000: { [mode]: celtOnly, [bandwidth]: narrowBand, [frameSize]: 5 },
    0b10010000: { [mode]: celtOnly, [bandwidth]: narrowBand, [frameSize]: 10 },
    0b10011000: { [mode]: celtOnly, [bandwidth]: narrowBand, [frameSize]: 20 },
    0b10100000: { [mode]: celtOnly, [bandwidth]: wideBand, [frameSize]: 2.5 },
    0b10101000: { [mode]: celtOnly, [bandwidth]: wideBand, [frameSize]: 5 },
    0b10110000: { [mode]: celtOnly, [bandwidth]: wideBand, [frameSize]: 10 },
    0b10111000: { [mode]: celtOnly, [bandwidth]: wideBand, [frameSize]: 20 },
    0b11000000: { [mode]: celtOnly, [bandwidth]: superWideBand, [frameSize]: 2.5 },
    0b11001000: { [mode]: celtOnly, [bandwidth]: superWideBand, [frameSize]: 5 },
    0b11010000: { [mode]: celtOnly, [bandwidth]: superWideBand, [frameSize]: 10 },
    0b11011000: { [mode]: celtOnly, [bandwidth]: superWideBand, [frameSize]: 20 },
    0b11100000: { [mode]: celtOnly, [bandwidth]: fullBand, [frameSize]: 2.5 },
    0b11101000: { [mode]: celtOnly, [bandwidth]: fullBand, [frameSize]: 5 },
    0b11110000: { [mode]: celtOnly, [bandwidth]: fullBand, [frameSize]: 10 },
    0b11111000: { [mode]: celtOnly, [bandwidth]: fullBand, [frameSize]: 20 },
  };

  class OpusHeader extends CodecHeader {
    static [getHeaderFromUint8Array](dataValue, packetData, headerCache) {
      const header = {};

      // get length of header
      // Byte (10 of 19)
      // * `CCCCCCCC`: Channel Count
      header[channels] = dataValue[9];
      // Byte (19 of 19)
      // * `GGGGGGGG`: Channel Mapping Family
      header[channelMappingFamily] = dataValue[18];

      header[length] =
        header[channelMappingFamily] !== 0 ? 21 + header[channels] : 19;

      if (dataValue[length] < header[length])
        throw new Error("Out of data while inside an Ogg Page");

      // Page Segment Bytes (1-2)
      // * `AAAAA...`: Packet config
      // * `.....B..`:
      // * `......CC`: Packet code
      const packetMode = packetData[0] & 0b00000011;
      const packetLength = packetMode === 3 ? 2 : 1;

      // Check header cache
      const key =
        bytesToString(dataValue[subarray](0, header[length])) +
        bytesToString(packetData[subarray](0, packetLength));
      const cachedHeader = headerCache[getHeader](key);

      if (cachedHeader) return new OpusHeader(cachedHeader);

      // Bytes (1-8 of 19): OpusHead - Magic Signature
      if (key.substr(0, 8) !== "OpusHead") {
        return null;
      }

      // Byte (9 of 19)
      // * `00000001`: Version number
      if (dataValue[8] !== 1) return null;

      header[data$1] = uint8Array.from(dataValue[subarray](0, header[length]));

      const view = new dataView(header[data$1][buffer]);

      header[bitDepth] = 16;

      // Byte (10 of 19)
      // * `CCCCCCCC`: Channel Count
      // set earlier to determine length

      // Byte (11-12 of 19)
      // * `DDDDDDDD|DDDDDDDD`: Pre skip
      header[preSkip] = view.getUint16(10, true);

      // Byte (13-16 of 19)
      // * `EEEEEEEE|EEEEEEEE|EEEEEEEE|EEEEEEEE`: Sample Rate
      header[inputSampleRate] = view.getUint32(12, true);
      // Opus is always decoded at 48kHz
      header[sampleRate] = rate48000;

      // Byte (17-18 of 19)
      // * `FFFFFFFF|FFFFFFFF`: Output Gain
      header[outputGain] = view.getInt16(16, true);

      // Byte (19 of 19)
      // * `GGGGGGGG`: Channel Mapping Family
      // set earlier to determine length
      if (header[channelMappingFamily] in channelMappingFamilies) {
        header[channelMode] =
          channelMappingFamilies[header[channelMappingFamily]][
            header[channels] - 1
          ];
        if (!header[channelMode]) return null;
      }

      if (header[channelMappingFamily] !== 0) {
        // * `HHHHHHHH`: Stream count
        header[streamCount] = dataValue[19];

        // * `IIIIIIII`: Coupled Stream count
        header[coupledStreamCount] = dataValue[20];

        // * `JJJJJJJJ|...` Channel Mapping table
        header[channelMappingTable] = [
          ...dataValue[subarray](21, header[channels] + 21),
        ];
      }

      const packetConfig = configTable[0b11111000 & packetData[0]];
      header[mode] = packetConfig[mode];
      header[bandwidth] = packetConfig[bandwidth];
      header[frameSize] = packetConfig[frameSize];

      // https://tools.ietf.org/html/rfc6716#appendix-B
      switch (packetMode) {
        case 0:
          // 0: 1 frame in the packet
          header[frameCount] = 1;
          break;
        case 1:
        // 1: 2 frames in the packet, each with equal compressed size
        case 2:
          // 2: 2 frames in the packet, with different compressed sizes
          header[frameCount] = 2;
          break;
        case 3:
          // 3: an arbitrary number of frames in the packet
          header[isVbr] = !!(0b10000000 & packetData[1]);
          header[hasOpusPadding] = !!(0b01000000 & packetData[1]);
          header[frameCount] = 0b00111111 & packetData[1];
          break;
        default:
          return null;
      }

      // set header cache
      {
        const {
          length,
          data: headerData,
          channelMappingFamily,
          ...codecUpdateFields
        } = header;

        headerCache[setHeader](key, header, codecUpdateFields);
      }

      return new OpusHeader(header);
    }

    /**
     * @private
     * Call OpusHeader.getHeader(Array<Uint8>) to get instance
     */
    constructor(header) {
      super(header);

      this[data$1] = header[data$1];
      this[bandwidth] = header[bandwidth];
      this[channelMappingFamily] = header[channelMappingFamily];
      this[channelMappingTable] = header[channelMappingTable];
      this[coupledStreamCount] = header[coupledStreamCount];
      this[frameCount] = header[frameCount];
      this[frameSize] = header[frameSize];
      this[hasOpusPadding] = header[hasOpusPadding];
      this[inputSampleRate] = header[inputSampleRate];
      this[isVbr] = header[isVbr];
      this[mode] = header[mode];
      this[outputGain] = header[outputGain];
      this[preSkip] = header[preSkip];
      this[streamCount] = header[streamCount];
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class OpusParser extends Parser {
    constructor(codecParser, headerCache, onCodec) {
      super(codecParser, headerCache);
      this.Frame = OpusFrame;
      this.Header = OpusHeader;

      onCodec(this[codec]);
      this._identificationHeader = null;
      this._preSkipRemaining = null;
    }

    get [codec]() {
      return "opus";
    }

    /**
     * @todo implement continued page support
     */
    [parseOggPage](oggPage) {
      if (oggPage[pageSequenceNumber] === 0) {
        // Identification header

        this._headerCache[enable]();
        this._identificationHeader = oggPage[data$1];
      } else if (oggPage[pageSequenceNumber] === 1) ; else {
        oggPage[codecFrames$1] = frameStore
          .get(oggPage)
          [segments].map((segment) => {
            const header = OpusHeader[getHeaderFromUint8Array](
              this._identificationHeader,
              segment,
              this._headerCache,
            );

            if (header) {
              if (this._preSkipRemaining === null)
                this._preSkipRemaining = header[preSkip];

              let samples =
                ((header[frameSize] * header[frameCount]) / 1000) *
                header[sampleRate];

              if (this._preSkipRemaining > 0) {
                this._preSkipRemaining -= samples;
                samples =
                  this._preSkipRemaining < 0 ? -this._preSkipRemaining : 0;
              }

              return new OpusFrame(segment, header, samples);
            }

            this._codecParser[logError$1](
              "Failed to parse Ogg Opus Header",
              "Not a valid Ogg Opus file",
            );
          });
      }

      return oggPage;
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class VorbisFrame extends CodecFrame {
    constructor(data, header, samples) {
      super(header, data, samples);
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  const blockSizes = {
    // 0b0110: 64,
    // 0b0111: 128,
    // 0b1000: 256,
    // 0b1001: 512,
    // 0b1010: 1024,
    // 0b1011: 2048,
    // 0b1100: 4096,
    // 0b1101: 8192
  };
  for (let i = 0; i < 8; i++) blockSizes[i + 6] = 2 ** (6 + i);

  class VorbisHeader extends CodecHeader {
    static [getHeaderFromUint8Array](
      dataValue,
      headerCache,
      vorbisCommentsData,
      vorbisSetupData,
    ) {
      // Must be at least 30 bytes.
      if (dataValue[length] < 30)
        throw new Error("Out of data while inside an Ogg Page");

      // Check header cache
      const key = bytesToString(dataValue[subarray](0, 30));
      const cachedHeader = headerCache[getHeader](key);
      if (cachedHeader) return new VorbisHeader(cachedHeader);

      const header = { [length]: 30 };

      // Bytes (1-7 of 30): /01vorbis - Magic Signature
      if (key.substr(0, 7) !== "\x01vorbis") {
        return null;
      }

      header[data$1] = uint8Array.from(dataValue[subarray](0, 30));
      const view = new dataView(header[data$1][buffer]);

      // Byte (8-11 of 30)
      // * `CCCCCCCC|CCCCCCCC|CCCCCCCC|CCCCCCCC`: Version number
      header[version] = view.getUint32(7, true);
      if (header[version] !== 0) return null;

      // Byte (12 of 30)
      // * `DDDDDDDD`: Channel Count
      header[channels] = dataValue[11];
      header[channelMode] =
        vorbisOpusChannelMapping[header[channels] - 1] || "application defined";

      // Byte (13-16 of 30)
      // * `EEEEEEEE|EEEEEEEE|EEEEEEEE|EEEEEEEE`: Sample Rate
      header[sampleRate] = view.getUint32(12, true);

      // Byte (17-20 of 30)
      // * `FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF`: Bitrate Maximum
      header[bitrateMaximum] = view.getInt32(16, true);

      // Byte (21-24 of 30)
      // * `GGGGGGGG|GGGGGGGG|GGGGGGGG|GGGGGGGG`: Bitrate Nominal
      header[bitrateNominal] = view.getInt32(20, true);

      // Byte (25-28 of 30)
      // * `HHHHHHHH|HHHHHHHH|HHHHHHHH|HHHHHHHH`: Bitrate Minimum
      header[bitrateMinimum] = view.getInt32(24, true);

      // Byte (29 of 30)
      // * `IIII....` Blocksize 1
      // * `....JJJJ` Blocksize 0
      header[blocksize1] = blockSizes[(dataValue[28] & 0b11110000) >> 4];
      header[blocksize0] = blockSizes[dataValue[28] & 0b00001111];
      if (header[blocksize0] > header[blocksize1]) return null;

      // Byte (29 of 30)
      // * `00000001` Framing bit
      if (dataValue[29] !== 0x01) return null;

      header[bitDepth] = 32;
      header[vorbisSetup$1] = vorbisSetupData;
      header[vorbisComments$1] = vorbisCommentsData;

      {
        // set header cache
        const {
          length,
          data,
          version,
          vorbisSetup,
          vorbisComments,
          ...codecUpdateFields
        } = header;
        headerCache[setHeader](key, header, codecUpdateFields);
      }

      return new VorbisHeader(header);
    }

    /**
     * @private
     * Call VorbisHeader.getHeader(Array<Uint8>) to get instance
     */
    constructor(header) {
      super(header);

      this[bitrateMaximum] = header[bitrateMaximum];
      this[bitrateMinimum] = header[bitrateMinimum];
      this[bitrateNominal] = header[bitrateNominal];
      this[blocksize0] = header[blocksize0];
      this[blocksize1] = header[blocksize1];
      this[data$1] = header[data$1];
      this[vorbisComments$1] = header[vorbisComments$1];
      this[vorbisSetup$1] = header[vorbisSetup$1];
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class VorbisParser extends Parser {
    constructor(codecParser, headerCache, onCodec) {
      super(codecParser, headerCache);
      this.Frame = VorbisFrame;

      onCodec(this[codec]);

      this._identificationHeader = null;
      this._setupComplete = false;

      this._prevBlockSize = null;
    }

    get [codec]() {
      return vorbis;
    }

    [parseOggPage](oggPage) {
      oggPage[codecFrames$1] = [];

      for (const oggPageSegment of frameStore.get(oggPage)[segments]) {
        if (oggPageSegment[0] === 1) {
          // Identification header

          this._headerCache[enable]();
          this._identificationHeader = oggPage[data$1];
          this._setupComplete = false;
        } else if (oggPageSegment[0] === 3) {
          // comment header

          this._vorbisComments = oggPageSegment;
        } else if (oggPageSegment[0] === 5) {
          // setup header

          this._vorbisSetup = oggPageSegment;
          this._mode = this._parseSetupHeader(oggPageSegment);
          this._setupComplete = true;
        } else if (this._setupComplete) {
          const header = VorbisHeader[getHeaderFromUint8Array](
            this._identificationHeader,
            this._headerCache,
            this._vorbisComments,
            this._vorbisSetup,
          );

          if (header) {
            oggPage[codecFrames$1].push(
              new VorbisFrame(
                oggPageSegment,
                header,
                this._getSamples(oggPageSegment, header),
              ),
            );
          } else {
            this._codecParser[logError](
              "Failed to parse Ogg Vorbis Header",
              "Not a valid Ogg Vorbis file",
            );
          }
        }
      }

      return oggPage;
    }

    _getSamples(segment, header) {
      const blockFlag =
        this._mode.blockFlags[(segment[0] >> 1) & this._mode.mask];

      const currentBlockSize = blockFlag
        ? header[blocksize1]
        : header[blocksize0];

      // data is not returned on the first frame, but is used to prime the decoder
      // https://xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-590004
      const samplesValue =
        this._prevBlockSize === null
          ? 0
          : (this._prevBlockSize + currentBlockSize) / 4;

      this._prevBlockSize = currentBlockSize;

      return samplesValue;
    }

    // https://gitlab.xiph.org/xiph/liboggz/-/blob/master/src/liboggz/oggz_auto.c#L911
    // https://github.com/FFmpeg/FFmpeg/blob/master/libavcodec/vorbis_parser.c
    /*
     * This is the format of the mode data at the end of the packet for all
     * Vorbis Version 1 :
     *
     * [ 6:number_of_modes ]
     * [ 1:size | 16:window_type(0) | 16:transform_type(0) | 8:mapping ]
     * [ 1:size | 16:window_type(0) | 16:transform_type(0) | 8:mapping ]
     * [ 1:size | 16:window_type(0) | 16:transform_type(0) | 8:mapping ]
     * [ 1:framing(1) ]
     *
     * e.g.:
     *
     * MsB         LsB
     *              <-
     * 0 0 0 0 0 1 0 0
     * 0 0 1 0 0 0 0 0
     * 0 0 1 0 0 0 0 0
     * 0 0 1|0 0 0 0 0
     * 0 0 0 0|0|0 0 0
     * 0 0 0 0 0 0 0 0
     * 0 0 0 0|0 0 0 0
     * 0 0 0 0 0 0 0 0
     * 0 0 0 0|0 0 0 0
     * 0 0 0|1|0 0 0 0 |
     * 0 0 0 0 0 0 0 0 V
     * 0 0 0|0 0 0 0 0
     * 0 0 0 0 0 0 0 0
     * 0 0|1 0 0 0 0 0
     *
     * The simplest way to approach this is to start at the end
     * and read backwards to determine the mode configuration.
     *
     * liboggz and ffmpeg both use this method.
     */
    _parseSetupHeader(setup) {
      const bitReader = new BitReader(setup);
      const mode = {
        count: 0,
        blockFlags: [],
      };

      // sync with the framing bit
      while ((bitReader.read(1) & 0x01) !== 1) {}

      let modeBits;
      // search in reverse to parse out the mode entries
      // limit mode count to 63 so previous block flag will be in first packet byte
      while (mode.count < 64 && bitReader.position > 0) {
        reverse(bitReader.read(8)); // read mapping

        // 16 bits transform type, 16 bits window type, all values must be zero
        let currentByte = 0;
        while (bitReader.read(8) === 0x00 && currentByte++ < 3) {} // a non-zero value may indicate the end of the mode entries, or invalid data

        if (currentByte === 4) {
          // transform type and window type were all zeros
          modeBits = bitReader.read(7); // modeBits may need to be used in the next iteration if this is the last mode entry
          mode.blockFlags.unshift(modeBits & 0x01); // read and store mode number -> block flag
          bitReader.position += 6; // go back 6 bits so next iteration starts right after the block flag
          mode.count++;
        } else {
          // transform type and window type were not all zeros
          // check for mode count using previous iteration modeBits
          if (((reverse(modeBits) & 0b01111110) >> 1) + 1 !== mode.count) {
            this._codecParser[logWarning](
              "vorbis derived mode count did not match actual mode count",
            );
          }

          break;
        }
      }

      // xxxxxxxa packet type
      // xxxxxxbx mode count (number of mode count bits)
      // xxxxxcxx previous window flag
      // xxxxdxxx next window flag
      mode.mask = (1 << Math.log2(mode.count)) - 1;

      return mode;
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  class OggStream {
    constructor(codecParser, headerCache, onCodec) {
      this._codecParser = codecParser;
      this._headerCache = headerCache;
      this._onCodec = onCodec;

      this._continuedPacket = new uint8Array();
      this._codec = null;
      this._isSupported = null;
      this._previousAbsoluteGranulePosition = null;
    }

    get [codec]() {
      return this._codec || "";
    }

    _updateCodec(codec, Parser) {
      if (this._codec !== codec) {
        this._headerCache[reset]();
        this._parser = new Parser(
          this._codecParser,
          this._headerCache,
          this._onCodec,
        );
        this._codec = codec;
      }
    }

    _checkCodecSupport({ data }) {
      const idString = bytesToString(data[subarray](0, 8));

      switch (idString) {
        case "fishead\0":
          return false; // ignore ogg skeleton packets
        case "OpusHead":
          this._updateCodec("opus", OpusParser);
          return true;
        case /^\x7fFLAC/.test(idString) && idString:
          this._updateCodec("flac", FLACParser);
          return true;
        case /^\x01vorbis/.test(idString) && idString:
          this._updateCodec(vorbis, VorbisParser);
          return true;
        default:
          return false;
      }
    }

    _checkPageSequenceNumber(oggPage) {
      if (
        oggPage[pageSequenceNumber] !== this._pageSequenceNumber + 1 &&
        this._pageSequenceNumber > 1 &&
        oggPage[pageSequenceNumber] > 1
      ) {
        this._codecParser[logWarning](
          "Unexpected gap in Ogg Page Sequence Number.",
          `Expected: ${this._pageSequenceNumber + 1}, Got: ${
          oggPage[pageSequenceNumber]
        }`,
        );
      }

      this._pageSequenceNumber = oggPage[pageSequenceNumber];
    }

    _parsePage(oggPage) {
      if (this._isSupported === null) {
        this._pageSequenceNumber = oggPage[pageSequenceNumber];
        this._isSupported = this._checkCodecSupport(oggPage);
      }

      this._checkPageSequenceNumber(oggPage);

      const oggPageStore = frameStore.get(oggPage);
      const headerData = headerStore.get(oggPageStore[header$1]);

      let offset = 0;
      oggPageStore[segments] = headerData[pageSegmentTable].map((segmentLength) =>
        oggPage[data$1][subarray](offset, (offset += segmentLength)),
      );

      // prepend any existing continued packet data
      if (this._continuedPacket[length]) {
        oggPageStore[segments][0] = concatBuffers(
          this._continuedPacket,
          oggPageStore[segments][0],
        );

        this._continuedPacket = new uint8Array();
      }

      // save any new continued packet data
      if (
        headerData[pageSegmentBytes][headerData[pageSegmentBytes][length] - 1] ===
        0xff
      ) {
        this._continuedPacket = concatBuffers(
          this._continuedPacket,
          oggPageStore[segments].pop(),
        );
      }

      // set total samples in this ogg page
      if (this._previousAbsoluteGranulePosition !== null) {
        oggPage[samples] = Number(
          oggPage[absoluteGranulePosition] -
            this._previousAbsoluteGranulePosition,
        );
      }

      this._previousAbsoluteGranulePosition = oggPage[absoluteGranulePosition];

      if (this._isSupported) {
        const frame = this._parser[parseOggPage](oggPage);
        this._codecParser[mapFrameStats](frame);

        return frame;
      } else {
        return oggPage;
      }
    }
  }

  class OggParser extends Parser {
    constructor(codecParser, headerCache, onCodec) {
      super(codecParser, headerCache);

      this._onCodec = onCodec;
      this.Frame = OggPage;
      this.Header = OggPageHeader;

      this._streams = new Map();
      this._currentSerialNumber = null;
    }

    get [codec]() {
      const oggStream = this._streams.get(this._currentSerialNumber);

      return oggStream ? oggStream.codec : "";
    }

    *[parseFrame]() {
      const oggPage = yield* this[fixedLengthFrameSync](true);
      this._currentSerialNumber = oggPage[streamSerialNumber];

      let oggStream = this._streams.get(this._currentSerialNumber);
      if (!oggStream) {
        oggStream = new OggStream(
          this._codecParser,
          this._headerCache,
          this._onCodec,
        );
        this._streams.set(this._currentSerialNumber, oggStream);
      }

      if (oggPage[isLastPage$1]) this._streams.delete(this._currentSerialNumber);

      return oggStream._parsePage(oggPage);
    }
  }

  /* Copyright 2020-2023 Ethan Halsall
      
      This file is part of codec-parser.
      
      codec-parser is free software: you can redistribute it and/or modify
      it under the terms of the GNU Lesser General Public License as published by
      the Free Software Foundation, either version 3 of the License, or
      (at your option) any later version.

      codec-parser is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU Lesser General Public License for more details.

      You should have received a copy of the GNU Lesser General Public License
      along with this program.  If not, see <https://www.gnu.org/licenses/>
  */


  const noOp = () => {};

  class CodecParser {
    constructor(
      mimeType,
      {
        onCodec,
        onCodecHeader,
        onCodecUpdate,
        enableLogging = false,
        enableFrameCRC32 = true,
      } = {},
    ) {
      this._inputMimeType = mimeType;
      this._onCodec = onCodec || noOp;
      this._onCodecHeader = onCodecHeader || noOp;
      this._onCodecUpdate = onCodecUpdate;
      this._enableLogging = enableLogging;
      this._crc32 = enableFrameCRC32 ? crc32Function : noOp;

      this[reset]();
    }

    /**
     * @public
     * @returns The detected codec
     */
    get [codec]() {
      return this._parser ? this._parser[codec] : "";
    }

    [reset]() {
      this._headerCache = new HeaderCache(
        this._onCodecHeader,
        this._onCodecUpdate,
      );

      this._generator = this._getGenerator();
      this._generator.next();
    }

    /**
     * @public
     * @description Generator function that yields any buffered CodecFrames and resets the CodecParser
     * @returns {Iterable<CodecFrame|OggPage>} Iterator that operates over the codec data.
     * @yields {CodecFrame|OggPage} Parsed codec or ogg page data
     */
    *flush() {
      this._flushing = true;

      for (let i = this._generator.next(); i.value; i = this._generator.next()) {
        yield i.value;
      }

      this._flushing = false;

      this[reset]();
    }

    /**
     * @public
     * @description Generator function takes in a Uint8Array of data and returns a CodecFrame from the data for each iteration
     * @param {Uint8Array} chunk Next chunk of codec data to read
     * @returns {Iterable<CodecFrame|OggPage>} Iterator that operates over the codec data.
     * @yields {CodecFrame|OggPage} Parsed codec or ogg page data
     */
    *parseChunk(chunk) {
      for (
        let i = this._generator.next(chunk);
        i.value;
        i = this._generator.next()
      ) {
        yield i.value;
      }
    }

    /**
     * @public
     * @description Parses an entire file and returns all of the contained frames.
     * @param {Uint8Array} fileData Coded data to read
     * @returns {Array<CodecFrame|OggPage>} CodecFrames
     */
    parseAll(fileData) {
      return [...this.parseChunk(fileData), ...this.flush()];
    }

    /**
     * @private
     */
    *_getGenerator() {
      if (this._inputMimeType.match(/aac/)) {
        this._parser = new AACParser(this, this._headerCache, this._onCodec);
      } else if (this._inputMimeType.match(/mpeg/)) {
        this._parser = new MPEGParser(this, this._headerCache, this._onCodec);
      } else if (this._inputMimeType.match(/flac/)) {
        this._parser = new FLACParser(this, this._headerCache, this._onCodec);
      } else if (this._inputMimeType.match(/ogg/)) {
        this._parser = new OggParser(this, this._headerCache, this._onCodec);
      } else {
        throw new Error(`Unsupported Codec ${mimeType}`);
      }

      this._frameNumber = 0;
      this._currentReadPosition = 0;
      this._totalBytesIn = 0;
      this._totalBytesOut = 0;
      this._totalSamples = 0;
      this._sampleRate = undefined;

      this._rawData = new Uint8Array(0);

      // start parsing out frames
      while (true) {
        const frame = yield* this._parser[parseFrame]();
        if (frame) yield frame;
      }
    }

    /**
     * @protected
     * @param {number} minSize Minimum bytes to have present in buffer
     * @returns {Uint8Array} rawData
     */
    *[readRawData](minSize = 0, readOffset = 0) {
      let rawData;

      while (this._rawData[length] <= minSize + readOffset) {
        rawData = yield;

        if (this._flushing) return this._rawData[subarray](readOffset);

        if (rawData) {
          this._totalBytesIn += rawData[length];
          this._rawData = concatBuffers(this._rawData, rawData);
        }
      }

      return this._rawData[subarray](readOffset);
    }

    /**
     * @protected
     * @param {number} increment Bytes to increment codec data
     */
    [incrementRawData](increment) {
      this._currentReadPosition += increment;
      this._rawData = this._rawData[subarray](increment);
    }

    /**
     * @protected
     */
    [mapCodecFrameStats](frame) {
      this._sampleRate = frame[header$1][sampleRate];

      frame[header$1][bitrate] =
        frame[duration] > 0
          ? Math.round(frame[data$1][length] / frame[duration]) * 8
          : 0;
      frame[frameNumber] = this._frameNumber++;
      frame[totalBytesOut] = this._totalBytesOut;
      frame[totalSamples$1] = this._totalSamples;
      frame[totalDuration] = (this._totalSamples / this._sampleRate) * 1000;
      frame[crc32$1] = this._crc32(frame[data$1]);

      this._headerCache[checkCodecUpdate](
        frame[header$1][bitrate],
        frame[totalDuration],
      );

      this._totalBytesOut += frame[data$1][length];
      this._totalSamples += frame[samples];
    }

    /**
     * @protected
     */
    [mapFrameStats](frame) {
      if (frame[codecFrames$1]) {
        // Ogg container
        if (frame[isLastPage$1]) {
          // cut any excess samples that fall outside of the absolute granule position
          // some streams put invalid data in absolute granule position, so only do this
          // for the end of the stream
          let absoluteGranulePositionSamples = frame[samples];

          frame[codecFrames$1].forEach((codecFrame) => {
            const untrimmedCodecSamples = codecFrame[samples];

            if (absoluteGranulePositionSamples < untrimmedCodecSamples) {
              codecFrame[samples] =
                absoluteGranulePositionSamples > 0
                  ? absoluteGranulePositionSamples
                  : 0;
              codecFrame[duration] =
                (codecFrame[samples] / codecFrame[header$1][sampleRate]) * 1000;
            }

            absoluteGranulePositionSamples -= untrimmedCodecSamples;

            this[mapCodecFrameStats](codecFrame);
          });
        } else {
          frame[samples] = 0;
          frame[codecFrames$1].forEach((codecFrame) => {
            frame[samples] += codecFrame[samples];
            this[mapCodecFrameStats](codecFrame);
          });
        }

        frame[duration] = (frame[samples] / this._sampleRate) * 1000 || 0;
        frame[totalSamples$1] = this._totalSamples;
        frame[totalDuration] =
          (this._totalSamples / this._sampleRate) * 1000 || 0;
        frame[totalBytesOut] = this._totalBytesOut;
      } else {
        this[mapCodecFrameStats](frame);
      }
    }

    /**
     * @private
     */
    _log(logger, messages) {
      if (this._enableLogging) {
        const stats = [
          `${codec}:         ${this[codec]}`,
          `inputMimeType: ${this._inputMimeType}`,
          `readPosition:  ${this._currentReadPosition}`,
          `totalBytesIn:  ${this._totalBytesIn}`,
          `${totalBytesOut}: ${this._totalBytesOut}`,
        ];

        const width = Math.max(...stats.map((s) => s[length]));

        messages.push(
          `--stats--${"-".repeat(width - 9)}`,
          ...stats,
          "-".repeat(width),
        );

        logger(
          "codec-parser",
          messages.reduce((acc, message) => acc + "\n  " + message, ""),
        );
      }
    }

    /**
     * @protected
     */
    [logWarning](...messages) {
      this._log(console.warn, messages);
    }

    /**
     * @protected
     */
    [logError$1](...messages) {
      this._log(console.error, messages);
    }
  }

  const codecFrames = codecFrames$1;
  const data = data$1;
  const header = header$1;
  const isLastPage = isLastPage$1;
  const vorbisComments = vorbisComments$1;
  const vorbisSetup = vorbisSetup$1;
  const totalSamples = totalSamples$1;

  /* **************************************************
   * This file is auto-generated during the build process.
   * Any edits to this file will be overwritten.
   ****************************************************/

  function EmscriptenWASM(WASMAudioDecoderCommon) {

  // Override this function in a --pre-js file to get a signal for when
  // compilation is ready. In that callback, call the function run() to start
  // the program.
  function ready() {}

  // end include: src/ogg-vorbis/src/emscripten-pre.js
  // end include: shell_minimal.js
  // include: preamble_minimal.js
  /** @param {string|number=} what */ function abort(what) {
    throw what;
  }

  var HEAPU8, wasmMemory;

  // include: runtime_shared.js
  // include: runtime_stack_check.js
  // end include: runtime_stack_check.js
  // include: runtime_exceptions.js
  // end include: runtime_exceptions.js
  // include: runtime_debug.js
  // end include: runtime_debug.js
  // include: memoryprofiler.js
  // end include: memoryprofiler.js
  function updateMemoryViews() {
    var b = wasmMemory.buffer;
    HEAPU8 = new Uint8Array(b);
    new BigInt64Array(b);
    new BigUint64Array(b);
  }

  var __abort_js = () => abort("");

  var __emscripten_runtime_keepalive_clear = () => {};

  var timers = {};

  var callUserCallback = func => func();

  var _emscripten_get_now = () => performance.now();

  var __setitimer_js = (which, timeout_ms) => {
    // First, clear any existing timer.
    if (timers[which]) {
      clearTimeout(timers[which].id);
      delete timers[which];
    }
    // A timeout of zero simply cancels the current timeout so we have nothing
    // more to do.
    if (!timeout_ms) return 0;
    var id = setTimeout(() => {
      delete timers[which];
      callUserCallback(() => __emscripten_timeout(which, _emscripten_get_now()));
    }, timeout_ms);
    timers[which] = {
      id,
      timeout_ms
    };
    return 0;
  };

  var _emscripten_math_atan = Math.atan;

  var _emscripten_math_cos = Math.cos;

  var _emscripten_math_exp = Math.exp;

  var _emscripten_math_log = Math.log;

  var _emscripten_math_pow = Math.pow;

  var _emscripten_math_sin = Math.sin;

  var _emscripten_resize_heap = requestedSize => {
    HEAPU8.length;
    return false;
  };

  var _proc_exit = code => {
    throw `exit(${code})`;
  };

  // Precreate a reverse lookup table from chars
  // "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" back to
  // bytes to make decoding fast.
  for (var base64ReverseLookup = new Uint8Array(123), i = 25; i >= 0; --i) {
    base64ReverseLookup[48 + i] = 52 + i;
    // '0-9'
    base64ReverseLookup[65 + i] = i;
    // 'A-Z'
    base64ReverseLookup[97 + i] = 26 + i;
  }

  base64ReverseLookup[43] = 62;

  // '+'
  base64ReverseLookup[47] = 63;

  var wasmImports = {
    /** @export */ "e": __abort_js,
    /** @export */ "d": __emscripten_runtime_keepalive_clear,
    /** @export */ "f": __setitimer_js,
    /** @export */ "b": _emscripten_math_atan,
    /** @export */ "a": _emscripten_math_cos,
    /** @export */ "i": _emscripten_math_exp,
    /** @export */ "h": _emscripten_math_log,
    /** @export */ "g": _emscripten_math_pow,
    /** @export */ "c": _emscripten_math_sin,
    /** @export */ "k": _emscripten_resize_heap,
    /** @export */ "j": _proc_exit
  };

  function assignWasmExports(wasmExports) {
    _create_decoder = wasmExports["n"];
    _malloc = wasmExports["o"];
    _send_setup = wasmExports["p"];
    _init_dsp = wasmExports["q"];
    _decode_packets = wasmExports["r"];
    _destroy_decoder = wasmExports["s"];
    _free = wasmExports["t"];
    __emscripten_timeout = wasmExports["v"];
  }

  var _create_decoder, _malloc, _send_setup, _init_dsp, _decode_packets, _destroy_decoder, _free, __emscripten_timeout;

  // include: postamble_minimal.js
  // === Auto-generated postamble setup entry stuff ===
  function initRuntime(wasmExports) {
    // No ATINITS hooks
    wasmExports["m"]();
  }

  // Initialize wasm (asynchronous)
  if (!EmscriptenWASM.wasm) Object.defineProperty(EmscriptenWASM, "wasm", {get: () => String.raw`dynEncode01e047b99803,l%ó1ð%ÏÍ,ÉîÎÎvg;(ÐÏÞ¨£6= o9é{B.½(«	5ø­ðàPÃ BDü"emQ¼P+ØrUùº3ÞHy
;OüÑÅH	Éº½1HJ;õìØO)ôüRè\Æÿ1ùÓ	*Å4ªÇÃÉ¤xsRê¾<â¢ 
Kd¹ºtää«ÓU~ÚhRLAmeáøðøéûòË¯VsWÂ3&f\qü=MÀìÎQöWg]|§ýÀ÷Qk+©Et<jc¹î¸Z_Ê¸mË;=}R<ºÅÂeG|]Î¤©Ã'oü¾_¯_]wd*FHþ¸^m½A©Æ¹hîE)WëúÉ¼C3yìFEV
ä=M&2¹ç= º´Eé9ËKsÝ-{5 §q¹d6U;Ì$µåÍOZ¨TÐxÎ±"æÑÊØº§¬¬¬¬ìonyÏ±Ã£ÃÓÝÿ1=}vìC0&E$FæGD(ÂÂÚN«µû76³/o³MÃxìýQ9rág©ª®6¨àÅ= G°Oå'dD= 83ÌpÄm¬À²ÞÍÀkÊã²UqÂFíxö
^Úd}îÛî
¬ UÅbÊj0)ÙY/nÎü5ø÷ÛtQÿi¼ 5í2U<ËÃ:üKcÈ³§Í(À*= ^w3YÊ<É~4Ã>Òë8ñÀQOÉÜBEý÷É?< ÐÄ¬})OäX>hï¤[À_©a/,ÑÉY½¥t=}§¦¿Ðu#tßà ¦H ûtz0vÃûãß¿ó½PßÖ	jßØ
°üÉ\ÖZâmÈs[m£ ¼ô<»G(ÑªêùLÐt«°= ¢(8ndqÆúÇ£@¯³%NÏ6>= m.Çâ7ÈTõ*4¹p±YìíHò~þéMN#ðh{Q¹ÑñºüãüÏ­½ jÈkÃ×I#C#EãïwÅ.¢U÷­Ã:\Ý9wÁó2µFá
¦ùT
¹®lÊ[Üúf5Ü_ÇMx¢1È¸#ÔÑÇÿ,Wêò¬}¢×^&ÄKóy\,7]&é µ³áâ=Mg¦$Õ.ìkK.UQ6h·¼¤AìHásÃkãèqkÇ Z"õøÑ,Is+Þ ±^WÝäé¿Ûy,ÍâÙÒéîÈ=}Õ±¿HSØNÕ,ÖÄ5ÆçN4wNÀ/ÖÁ(a_ÉP¸'Ñ¸¬%U\/|l,=M('Qôo³|²«ÚÔ	ÇÂÚ&>ã&¯ÝbÎOQo[= £8+ßdÁ'g§ 9qc¢-wî~brq8ã.ÙOv7G~(«m°Ç ÝsZU$¿»6è ,VÑákÊ;7çÂ­ò}kðåúÔ5wçn*)ö[lWz­hé LÎ£LnxèlÌ£hýøÀo.¢ÜÃÍÀ§»¡ÓNÐªÛP!X=}ªb·cÊr· f¾ÊvHÌËo+òBÊ\bWagÔÉV¿?:Á=M5SÅa¯ÀhGè\Xë]3îãÅÞï7&ÿ."âKæ}ö
Ý³8?_*ÆEÀÎ ¢«ùNO®¢ýMjqè#°ê|4n²Ú>Y³ÏeùÊ·BúJ= ^±u|»¿Ïü(2ó~mmÓTA²=MµR|×QØCÀîQj jK%Á{ì| ÏÀ3ó	x§â­³ÆUÜÑ_Q5·Wá6[Ú%¬¾Î=}U]Þ·Ý¬_ý©æàñ!$¸+ÜÞuqèã20d¿+_Ð=}_Ð=}ñæXA¾V­ SåHË= çU=}Ap2½G±a/ À3nÝ5íÓoô¦= {$:[>£í£(SòéøøëVÐ¾ªõ§	Õ"î±¬Jô?;£g_#ùW{+-¿nwNëføÄÈª'G|Úô?ÀEr¶Ã_~bj~åÃwl"kÏR	ÚäæZó¯Â%;Ë=MîõèÉÒéÆ©¢~î|ñkAbØø}p%lþ³L®ÛôzóD§ú*ì\®³Qj!Ùrk;H9
úìJ/ã§È v7Òü½º§t÷Ýrâ?FÝ¦=MÄÁñz¢î<µ>¥P>®£LßÃ¤ËªSp; *	
Çø®ÇºÆ"w3 ©ÛõtÂ\1ÏÄ!EFI¨ôÈV°¡"b²ï²"Òrab2Îó©Sr
²\«	ïH}º\pÅp>ñ´¿ÎÊ«¾2)àÏêtåý­î·=M_& D8ã ­ÊêGÞû3êDÛ/.¢¿QT<yºwìwt·e@Ídî$ÆÖ§tfýöºqñlQ£ÄHhêDv\% P[²?vÉNÒob2Þ=}®4ÅE
ÕBß$=Móþ6Örs¿Ý}ÏIú¸ynAt,ÈìvÒNhè­ÄMåøBVa*ÖÀ¿/C=}Sþ¬±[b)S~G)å=}dHdKb¾@,ÍçLñ×y1Oæ£~=}FbËçÍà³[°ÀÚL)Bëa¸K½íÚ}ÏgÓìÑ!.¦:«þ±þP3÷í¾%kã°QU%6uùO¸Ït9°Oy68ÿ×Â5"våñ¸= e¬=M^ÔåTÀÝórÎd#¡Ê§bõÀÑOÉ8@ÕC¡êÐðÿ= ÿë6¾ê6ÍÜÐÞy2}ÖÞÑÚÞIØp4p¹éýZßÄÖÞ$Äß¶®IüÁ5úHk¡2¿Ê]êyÜV­b OOD¥IÆVr±S®jîú[meRÅy2m^üJÇ@Çò³Å=Mô¾ã=}&êR7 ]ÇÃç&êÊÀ}zY»ml	Ð ºÌ_¶|·µûÁá!G?,qñ§ïc _°êÀö¬aØç|é©ç¤°å{YæüUþµ^¡A*?O"Ö$Uxa|!Ô7c
s"3º3ff4ÈRêMÒM°¹P¶ ¹êB°Í;ÁVcÎ¾êWûTß6¿wMewùTQ<ÈÐp!»êcLO²°¥°å©ÀjJÌ©y /yÊàãÈüE»/QÜ> ÔW+ekJeâkHekÆcø4®X·öq/lÚ¾KÄPìíºÙ+?mK¨0'!ÁìbÃ¼;èÖ?È?a7ÑùìË»°Z°m>m\,tÄ*âëÀ	gÐ^cn©ÿÑß3½sl¥q-.|±O%	0gzqù>6:ùÆQçñ*¿0ÔMÀ#î8ÄÄ9bÑn¹ÔË?úèBÁfWcïB½îHy­f³þÍØXººÍÂÁ³^Á=}|V=Uº¥Ý´eã}Í~wüm2(~NË^4øè¸Ö ·ÆØeí*®4TaËr<7<3jcæ´ éEº0ìÇMS/Xª­õX[%;Av6Ï(Çpá©)wÛ|E£v·UùÄ¨ÔÝËØEÊ9ÉX¿¼c!´Aõ÷0þÀâcôÚ=}É°'ù¹;ÍTQ0UtTn¥xz¥¸8Y³¨øþÐUY¿w¦E¢Ã V=}ßO}ú·ä#ïxYÜ ï?Õ= k£ÀZ²ôÌá§Ý@§f þP<Õ= }Õ= £°µ=}Õ= }Õ= §É³Ã?Û£TÀ+B½.{µrµ_xKrY4}ÎèÑäÁäDm=MÆßÅgÞw·Þ7i{¼æ³·î%G¦(²êçnz.N-
ÂÔ5ô©4_ü
[SìOÜå«Ë}Ò¨5-8µH7ì5-øú= Ç	¦l5í Ó"\ ÞýºPùzVUäJ¢°µí6¹Ãýz¬úËI63üM=M2:O²&Îó)qa¨0ÞÚõ/ÕäªtÏËKÇ´= ]{òYÑÖµ,Ñ}õ^Î
Ü¢Þ¢<Ø¡7¾jbYHA/¹¯´)Ï£Ò?cYæ*©¾ÙØ2ªçÙn­{³}´Óq%Âmà÷ý[¢õbµnD­IÆI£Ã*D*ùFæò©3ó¸Õ®ÚºoÌÁ¾zà­ë^X\¹µÉvùÞ¿h4bhÚ#P9£fËV«æyC´= {¹AL¶F.?ÐuÈ~T¦¤êºFIæ[H«âûè2x!{ÁûÕTU8Øp ö!pÏòíNS
½|7d'IDÄW6Eê¨îóÜ?lîþ2CQJlå»-.©}úi¿]½Í»AÐïW ½ý°[T×HÎþ¿uóÿh_çW¯î['WÒÍRÏ
´"«´/W Ö¼»%Í(1>V¶¸K¶gÎËÐMÉÛÏJ_ÝÜ÷
ËÿXº3¶æÚóì5©¡åg,*,ÚÄÐsR"¥"Mo/ÁSõzfG[{nJOçÍï Ó'¬¼ÞFòaÉÎpóÈïÍWW%Â
ó$](JyyX¶ûÄôcs$T»ÐÃ2¨Ï¦"-RtØ«K¨:ÀÚ\a	·ÚìaNGÖ²å0Ü5IQ!FRÜ	]ð½áÑ½¾M:çØ DRf7½W×ºmÃÇ]ª\,¡LªDHuÓ|Ä¥U¶¾G¾Ôõ¥/ÈJGn8É	'Ø¯V×cµË)íòó=}Î¼£Mb]à)çoæ>§ <LoRÿÊ³/ÀZY°^V¾fr£W4^#¥*ÎÍÍz|ö¹M¿#ÉU{
¢¬E41_¾$¶¿0Õ8Ù v)ï<ÎHiÎ6¦)4;NûèµyKþµXËëså¢Oh»iÑfN<]U~|,Ðú«æÛ)cI©z~«O§nÍ¹½ÓÕÀfkgº}³¯ÖRÔ¹N£.¿¸WÚ¦PZuSEËx-ó@Kî@l-©ø¹©6Å5Z¤dæAØVûì@
tq×õ®\*Úâ\|½G¯L&­SÆ«æ'5ÀÍ=}§ñ³(K-¥Ö÷7©S}¥÷>CÌ7E=Måûû6³ûÓ´¨82(Ý´îX]0Æ×$Ó t×= +s¢À4ýJ*ÓUMg±ëÏî
|n0Gªî1ì_K	tDa4X5ÕëyrúV1	ÕKù5Ýs!½è3ÁÀC£xûÈ{#þqiFns][2.óU:Î*øÚM¡Ù@^äêµH0ëk5âpG§ù»\æøiÒt<ÀÄåæðr¯E£ù	wùwóA=}ò}õ¦GÞø]')/ÈïÞëÞ¾1ÝµÅ,¡*øã¸|h;_=M·×Éå<Ä3<û±ò]éÕÖÓ+%î>3V&OÌH®${¢®{Ð
®Ô+ºCå«|=}ö§²«âr*U©(m¤#X¦Æ¬È¹ÈFQ.=MOnwè|FÙøºD,|´²uôE 3( ÜoQ£â³fÃ¦WnyUÆ¦VaVò±= ~$@gCÊRÕ7CÊ¤,b¸þs¡uZIð¾¹&TôïI¼±y¼
ÛÿïV­yJÂJ^ÿÒ	äµÀ-¿ÁýÝèq=M°'|ÞÙÅn5±ÛGø«%«|_p ÝëÑø~~ß;i¶8Ø1¸]ÝhH[Ý¤ë·T?	[(pÞÍ¼ë£sÓÔ%Ë]+âß¾+÷ÍÇÞ	Ï+¶+N?; +ØÁ^¸ûOgVÖ#?Ú³-Ñßó=M£xMp\ëÅ+×Ö´-®*ó1@=MP½¤rz¾v\Ä¯>}qìM#vL°Ø@äé71ÆÓXYGfªî<Ô =}-½·ÿÖß<å'RÍÎIzy~ßGÿÚË0U{yÍÃ»ñÌé¢ê°L¯ÞhlëÆÃó\yÁ¿	88	Â¨¬ø@à#w¹KÏÕ4#566F6Æ«/ÐOçÐa[³¸I}¾Ie¸ôÑò ñÿ@]g¹]E÷AD
Ã;oÝ
"h,·ýJDôMÃyÅPôðÛ"ù%k °ÆËóRìY÷Í-Èë<!87Så{ aÏàa=MÔV³v;C´&Û?ýÃÛÿCY³îÂèá= ùqM¡4Ï­W/N!3~Ä(¸´7ÌîÝHo\Kçéy¤W¾ÒÑÚÔ-H¼&vQ°+äx¨©§AßcrnÙÃE?~>à\~à½lïs_33
«ª«÷6h«£ÜM½Ä]ÉÜ«ýÿÔÚÍ¨°æY×cïËÃÞÝÂµ^¦Â¡¿UÒ=}ñsAù£le>ù=}RÍlúÁ¥Æ\¢S·¾hçY@»0ÒMO«²gØ}B×$©aSIq|tFöÃ²Ön®ã@âû]Åþt»®mÒ=}7¸Yöºz¯7?¹þfväÈëb66Ãi	áh£ L)n7¬FA¸ ÆNªIp!ùÛ\pÑ}²ëC¤és¾_ð:A<ãÌkïÕcTdÐAIG¢Üw	DÁ9-(Px
IÒÓ)SnbCSr¨­}9-AUMcñ[h¤gãQñ× âYËj£XóÔXÇ~àæÞv
¾À©(qY­ÂP¨^×#Î·/wì©:BÊIýoÀóõ8OÑiÔijh««·åNv#W^'Ix²Ùy¢ÙÉ^ðlÚrY4LàY;0o4zÍ"ó"+UdÖÈrÖûØÑjþïÓúu^R·?¬¿á¤·=M8mdæÜ}8$= 9ÔÐ½ú¤=M¬­)ÂK´þ~­4©
"i2Ûw0yì¢åyMY)Ô>rm×2mÝX°ø¡éYìÍèKï@R¦ØÑsy|õQ¤Xöú"õº-£9eÝ&çÐø'Tn²nÜ°R~Á@Ý^èæÄ/ WGAY¸Ó°¢«³-¢CÉ}öò£Ëï«É.£ì¯GÐ®e3Ú¦zÍ=}g¢u6­ïI	Î 2üJö9òd t[^Ho4£4¬jÂdøã³	¹~&?CH*<ïóz}Jß³SþÁr"Ê<gù¯á¶µTr([áñ]ñf,Â÷T_Ôv°û9!ÉR'Ô#)·X¾8ev¢dRÑ]%v´@,¾Åhf	å,NÆô3/~äÆ:¢ôä@±Q/B»°/°<*4a@hÌÂb>['¾³¸RE îÌ¥ª¡]Ê£2WßµÍoè±åÔðÊ=M.½yÖË^¨eE¨ÔÑ{;Ñm¤Á¶g¢äääÏeÙýÝ4ppÐ&¼gê«3¿é:%xK1AðtÈ4fmD+@ÇóhÀ¬´þülKùsÏR#ÒÏ¢Æ;3§p$U­Xaã5w½"ÃÆ"n7òE0B¸,9É'áq1CñMl!ë´©úí2ÐäZðÓ3ä¿9 ¡ÌmÂ0.YG§@¡+þR4¡©S¿´Ò»ÄÌÖ~O×>¼¸zcF7¸q{lÛ,¹7!>Wv0}Ï;ÜLÛ$<×oI4n;IOÍ»¢~³jr¬¶1ØU¨Q+N¹eMÑ¢µKâÎ.,÷4q%x#% ìµdWÅGV´Ïs¤^ùãÌ¤=}èµèÆW?*Ûlyw<É3%ÑT.1íNaú´îôJ (Üê1ã¤µÂUoK¨Ì¹PÂ=}He®!ÕØT3¨£ñEQz*Þ0BÛS PÅ²l¶»»dD*¼lû7°Õä®8ØÿH¦ÙÑEíRKt)ron(	RoF·
cy¦õØa¼ØýådG9ÂÓcoPlÎþJa|u	ÇäªÉ4\ªÊ^N*å #¥hpÊ@RA¨Ë4ìer©tD9µOLMTD»|fQ»Z/-ÃJ@?­8¯¤0kÜ¼ü«|ß÷¯4­_+GwVÕá½GúeUêivX!Ü:¸ýf;UR:·Pz¨7¶>¨{îíª~jñ"Ø&öE/Á¿-m?3ª¾ê­Zõ"Ù¹ûïgjÝ¬dìíÂÀþ#bsåmxu2ârõÇiQ}Ê1¥Í'{ËlåÜ_´E-,Z t;f>{Ãnc"ùíÊ4ÎÙ]å­7è¦ByÀ5ÒNãÂÔ¤w³"VFJµXó­Öè;q1Rµ7ë¾hO^ó9égOÉh\z:ÈDÜùÏ2o+jùhµ8i8Vív[i¢ò"£nR5_ùö#uU-/Uv×}¼nsoÀ«¾[ð¡9¶JJøt6çfÈÇÕ^ÜÇ±±yËÓòíénYtlòÅ,ttÊ¼¼^³èUq4½*½lbRÔ 4Ø'äÿ´!T!(#¢a}~àÎàmkí6#ãìMyí	jèkàPºµñ®SÐìÊgóZK|Aöü´	{|&´ÔÕxJÖ@¬HÚ­¯2¾:jô¶¬µdÆt@íë:¼*}}~Á1Sé¾FØ:D
EX
ÕS¬õØN¾0²}e~êP	Y3qµâFuC2¢ û<*êå7¢¥êâpN1©[ÓIzM5×3º½ÜöØvÉ¦BåóÕ1{Z³vSÑØ½I\çhÐË÷PÏlº,nA nÕ_Å¾Ù8mÕÛjA&výíXYÔ Áàÿ¦ó£ÐXÑËAQ,Úâ¾*ÚJÁ¯ârjjS*oftM#jÿCjó¨%ghi¼"­1ÔôêtçtP£pr
Àª+³[N¾¼F_ÎmnÛ8ßv]õ\ï#n8à[¿±0í»Tî©<P±MÖ÷øOé0Ôê5Q£ÞÁZ¸ùR¯fD3fÝ£S]þ'×ä><H¸iüøOãª¦tµN×¸ñøí)8f¤&°ï¹ók9úæ6²Ã,z¿ð×QQÛL+ò)ÒDàëÁ~f(Ta¥ç¼XC-g~4{ÝÿÔ.k7§HÏÛ¼zäwÅ#%ÔMV05¨nCì·eª­ -©ÞL®»Nk»L#¿YÐè^@Rp³Ümºw£É¢2]Î0êÍ£§þü>HÌ]>¼G÷½P¿ÁÀlþL{Å +Á´báòC, ñ}QV§d	ÑsVËÈtgö¡¹ù+KvºÄ©Oá= y6%1ÔvËK+¤ùÕ5<]uÑ0_Ã8Lþ0áüã5þkÃ©vfSÃsùÒéâåÿê6j«=MqXq>ðÍèdÂÍÀã #rª9eµý2
3óÈñõrc/ÿ¦T¼ìùKOë>v)$ÙGô
ÀÜpdu6ª#:©:}!°R ¦Í×dËàÌàG&lì[«ª8L­?ÙTî|ÈdëÈr*f"\#þ]¶IÝxX=M¥R@ùXfPd}æN¿Ö1= ¾K0	±ñ#òÁ{Èá ïcÃj"$þ¸uÜTï^´= mv9Ge&äÙú>¬Z«ý©´ýa VBäAÀå^$w~òH©ªR£·^Õ:fù(_4ÔVWËôì)\fî5ØMú)¼_ÿ+ ¤ó@íJ(H1o}^Ú¦Ê>¬c>TìcµÞ,4ÀwÝô.³KË>ì|f0st¡fçqÑ?èËæTÎeÖæÈå÷ØªÔþì\¸Z®ÒÂvúá 53ªx KçVúêq¢©F_$±f^Y(
iý3_ôaÜ2äòÂtã^æ Jf%Hú|Zgð Y5÷i¶þ«1*{Í0?{y¬¬FÆ;ãvºÀ5T´wîdKP£Ínº²±^Èéï¬yV4*Tu.\=}ÙØV¡×ÀúfÄÁx&(ç½ªÁÂ×QnXQH½Ñw-²QÿÒ·¸±09 NÓØ¢Øu;0òêJ'®@ª_pKúÒg*,¡ªM®V?M¿±âW*þH66¤Ê!ª{Ï£¬¥]pHY$u0ÒzÐ³Ê!çÏD¬û½£çä&õ-¯¡<Daó·Ô-©Æ<Ç$3L¿ ¬M?ô[TñÅÛQ²o¡*"]ú5n/@iå¶¼y+{:$bøZB:rmà ÝDì3ÒÈ°¨'3Âøb	µ·­é¡$r= ±óÑ¦}wF¿ÇHn5ñ°F1®®ÓÀOc8³æN$£Mm!4áöLÐÙÍQ&tHdN#ÕÆË6Ñ|Òg!1wý#H$î¢D»û*"§×%Ï2¦¥Ùa{+úSúOÙ|Ô6CÒììl<EäKtSÓ%6<x(ªzà/µhúüµn= bS®Â/ä8=MC¿e9H¼@=M¶!úç>,#p&ß¤ýÿÐw"×"HázÚÊÃ¡¿Ùv_:ÌØM=}êÀÖ¬g_ØÛ}bÚÑÃßÄ×Ý£¦ÛÁKÞSÅØO]ÁÇ?RÜs·¾¶"gØY¯%ù+³cØ¹ßQ¿AQåÅMxAÛÇP+¥ú!án$÷4ãt»+»Hä¨Ùr#­ØøxWg[^Àýø°©&Ú@àRØîù{I8d¥©=Mô¾¤ýQq-ªáÄ=}fzQ71P@[Ö¬»ÚA9TXÆN©DÎ¢ì)fÝsK]®uÉZÁá\ÞdZ¸x"qIõöbo·<3ÚøT.¿YÒøXúüM »-èKeâÚâ,e2	·dZþÒÃÍ£ùúP+ðhpÇÖp¢ÄØAèËooX»W<í[OÅ:ÞrWÚ*7>ûÜÑfSíø¾6(zfô+Ï._ÛµU Zu®ÉL=MÊ-£¤?­<=M0¡øïö´aÇ£z¡@MÚ*+SJÎM¡
RH#Y#ÜrÐV¨H3kæÊ t!;{ÞU]®bã ªú°¡áõn¿ï)%AÚí8õm ´PuÓÒ¤¸í>oÀ3ó\N Î;õý¹6r9ð¦ïµñéÄwtÈhé¨4È$íÂúCIÀS~;= üîí·½>)éîÃ¸xò=}Ke°Õ¹"ÝlÂÿãs3WÝ!µXKÍ@}.Ã¦{ÀÌ²ôðNÈ6A_>4Oö(0¶§áõG}0ÓÇ	= !ZÙÊòi<ù¾%37®§fÇjÜâÒèÀ{g5°Á:2&s/X¸>|ó"Õê.6!Y¹Ö­ßèqÉÈàs1$7õCDôG3Õ¹½ÆTT,_3ÎîÍ?*õWÙT(Ú5Ùÿ= #ÂV¯Î£Éð¯tÝÖô_b(øÜ|Î}öN]Ùâßn<ú¾wÔÚBúB¡7&íºt+'a£ìEÔX·KQx'ÿ}ª= ã¦¨rÐñ<­µ_üeÄÌÜbä\ãaÏ{Í[,ß(ïeÐÉT¸|ç­Í·ÇÈa®üYe?ßõa9åy%æfLk=}¥íÌ
N®Vº_Nê[¬! $	u	åskûßh)ãÿcÝçh¬"\]96HµÇdðÎ@¿è,)ÛñD µ¿ÊTho¼
o¾¦QÑ"9\)Õ××ªÏÏ©^°Ùº=M	¾þÃæ®j{äf[%Ûdb@S°íã°£Køj2J2©sÊ¢õàïÿÿÛk/hóMå¶D¶ó~u¨§óDvái8ô<ùXnÅ´º(XÒz_2)/<:Z6#ÅÙkÒx­m.\Â[ßÎ qG|jÕõk1ÚmXRZëg[ï´í2CÖVð/ø®ìh/ÐsÿÙè=M=Ui¤]­¸]I[´k-0ØÞ¢5$ÒkPÙ4ÃIÙY¸(V(0tâxû#ÄwôÓ¡ü÷ùê=}_= y9ø 6$?UCî·*ñ¯;²¤³«S¯òëÙ©ÒMeíP= AW¹hé¡¼BH2cÞ0	ca9x&FÍËNQ$+ü]®]jdNöÝ~âd%lí-À=MÅ£NF¿È9nÇ#<T¸W¦þ°8·ÂfúÂ³ë¼öúâú+9%öóÇÛ²xÆ(ó]uüùråó-¬óèî2tf¥Î¸A'¶ø~ah°t2:£ÛèÄ¿øBÅAø
*fµá²Ep}#fþº_°ÿ¨zÞ%¸ÿ<àD¹Wi)b¤c §(ÄaØýÔÖÄX§ÝÑ%V4>ÑtHÛ {Um­ío.l'2zµýweU;ì}?³ÑËÁ±|õTßzÝ¢IkÙÊ§¹z)ªxÍ©ÕÚê¾]?àêå?g¥^gZó?°4À¯B,cï­;{ýRGÂ}i4gR=}®çg',/kºÅéÅä¥Âä_eþÅ{%QQ$<«Pò'ùÄRjËiXUÐPÐ&²æ.¿Ýr½¿aAÜ:#t4!ú4é=},küßO0§DïCçG-êJ¥³hBg#¯m-=M[-\=}·_Øë×þÜþ
Aä¶ì´Í«dÔ|QoÆ»_x,ë}lð!ú
¯§N§ÌY_ÌZf<Käsûìä°¯á]äÇ= µå@åÔàÔã ê= õfwâ8¯ákè8­á«ë 	 Ë´ø ûÀs,êfsàÒüi= íF<à}â²åÀ«ôÐÛ	ª1 ÷ÅñïðQ¶«Åª×¢dÝ¸ fÿ<Uòu»YÇÏRÖaÇ_¯Am|E[ !Ió  8³5úÏö@
¾
[Phhvù$ùÄìR3æIm±Cð=MhN¨ÁPÐ
júI$«%ú½&=M&±wè<%Ã²ß71)&(¼òíd ëpÂOÚrªÜ	?mMÞ£Éh]lÂÜCÂúbHL»±¸»&Lg¹¡[}XÁæÞ;[ÐÊ5½RÓ©K#9kÜì%~2g¥ô'¬,úÍyÎFl|Ë9T¬¹Â=}m$¸Ñ¬û×&òYö\ßß»jÍ[k]küXloEüZ6<èý6ý÷,Ñ	K&<Ô×¯_ÚÕw<2ÀGßØ¿_ÞV¼±C<«5¯y¡#<©í¯-H©@¿I²+Nùá;a²¶OÒ ¨Ô¼7ªÆèêþûùÐ¤ÓTB@C²ÁÇ%ð»Ñ²ÑªQ7óë¸µôÁ©iJlÎÅÒ,úp'å)Ãên	ç-<YÅËü>½g¡ûsH5e­)¦U§æV"IKâ<£I ÂB²-§v
5^ñ8dý¥bKL²ítiDí©tnPh+Íxü5*ìEìý³ÈÄ¸Õ´¿J8TüBýûnõ¯úvÌhõY/jMÀìÇ.¼¢ùÃønû ¦ÅIrÔ=MESè«LêÂªHi»ì¯Èø!æ9§GæMTüÈCJ»~ýq×ÅE5ötßúv**C]rº ³¢p¶gnäjF3 ¾Á8¤þÖÓWÌi¯QÄ9}IÒØpÜô1=}"ÄgqG¯SdôJ~öÏ8ÄdÂ­ÿéµ<}äª;0»ì9è¯ Gn$¾	'Í²r©M{(A[¨Pìâ¼DýÔý,QQ¸q%.P{Ýðõ9@õnùÕ8¿úî99\
nxw¥v óûÒ¼IAW¥%ðyUq¶¬¬alG:ïígPO®PesÖ§ ÍwýËNKP7¸®DOÙ
e]¨hxEtºÂãû~T¹ëÛ' ÁÞÍÁYGB¤er1¸Ð))ü"H£§=}&t0úúwø£2rv¢oðé5=MyÀD·jÐ37I$­v}Ù¸ùäÑð\cr° øfaÐß7,ðä¥à³·»ì,ÿXÎúmùL ÔS<â$ÖÓÐEÿ\É½w-?ñMÅ#.GËÚ¸ÂP¾{KegW];ÑüWÝVFZîôtqÑ«DD²¯Þï´
û vº¡y1h´þY%Éý¬s5JÕÎâÄ¦uM+vÍG©îÍÌ§¬ÌEfç?ïr'«¬ÐxùÏ¯EFFFFFFØlUM×¬ÄÌ2)öt.Q7ÌpfÄ=M]Cë¡>ÎMª¡äïîYÔfIê8_s|§ü¾®´$tÿÊ©ö_Éú¶tkÔ©¦Íß*°5iïÕDæPíOîÍwrIòX®#D¾ÕÕ0ê*îARó¢|äÀ ï =MB[q.f#Ä5= 'ÀET'âE[Ä Kíë4%wrBî@#ªÞÉD<s8Ì6E\K0_»ì¶o ­}àÒ´^ä	¸= r'¼hÞðÍðÞ6]Äíú^pn&¢ùoªq³¼MÕq+(Í®?,^)¦X¼ÅÄHU©q?Äµ§ï¥íì0=  mâvHÌ1+ÿÚDXÄXä*ÎÑ¯Ù÷»^ñ<bdwÁòÜò>ed¿E¢ÿ ÁU(ØãJ¨Éa>;Ô3¿ds¬æî5t·¬P÷¤·Sd®ñ I4a/mÊXéXAÙòåZÙä©ÇÃB°=}=}ýt¹Å$yÅÜãÓ'Ñ|i&üÇ7¤Î0\n3IùÉ¹l1îä³ýv}Iv H*XÊÚ¬ ­*jEù= Ñ.Ó¡l!64a5<àïÎ2 Ûî Fóúx\£l®T'4	-.4qÍ)G"ç³Èè(×Û²ñð= ÁîkÐ·Ú|·ªæOM ¨j{õÙ6ÝÙ HÑ¿ÿ<¡òÖnñÅ°þN4ùýCÈyl+ÕnlÌ,Â7 ª²´¾6D=MòJêÐT+ïL2(*>£= CÝ,Ä¸¨(À¸êfFs*r2¥17}lö[UDf¥®©öGWn(Ã¬âmújýnwîxâ¹-v>nÜNHy-z)FÇ%ýôâ-RQ0ó?&\Õwç§Êr|ùTÏ{Áv/Äe"xxÍw8NF7á{ÃÒ3¬Á+,¼mºkgk­= £9û\73yÖúò«^B?BY-[gâI©bó\O¨ãÐ\aùñ»tja,áfí)Q*°¦h
r=}gº=M¥ÕLê´Öþ]v<Cù'´B¥Ã!?×=MÈARÔjÕv+ÕÕvÊ[m,ü7Á?rRÔ×Bº.û>?!]ïwfîyHÇî¸ â+ðê{q¸}(âç¥?kûèÁÐ><ý!Nèá'Nuèð¦Æ-æÜOÐlc¸ï©lã;r(>Z.¯VòäÒ  ±8^¡lZ!.ñÈ×,ðãy¼K9¼Kù>9Óù½K¤­ðÓJfM4uBèI Ý´ØöÑ?/Ió?±ýæ-S­ãñGhö#©Uh§gÍ	ôûaA»4ÕÇ= *-¢Uj¸9(¯nq>Bîv¥Röá­Á|©g¢:¾ynV×JkV058MÇÓ,íV4ÇxSÀ|léGµHKF?¡º²^Ýc·ÛÝHÞU¸ãÖ/DÕòhnuÂÚÈÑ©xm¿F.UêéyoÐ0ÜÍ:gH/smVý\Tó=M¼LâËÐxØ'ð1¼©Þy¢ò[:t¸B.&7°&ò¥Âoq5Ü]¥èb>ÉñWÝÌ'Dip*rË&OÄFQ{¡ò#i«{àõéf¤0mì{?jÅ§Q¼î5;Æ t´oÌ8=MCªf¶6Â¤¼J¯Lþ;eó¢9ááfrÉEâÊ&ØmFvtÃó8±G¥àôInGÖMó³õîÛõ±Ö£L:¡\°Üuãñº¥*_¡IH±yï%¿m¹)/ªÞf­iwùw8ýÛªI3Q\ÆÁáÔç~âæ*/[L¼UaUøMqÍQí3Ðì+'úpDÞ5E (Wc?uã²9gDP§0}¡ jö"ÄBÃÔ.mä¸ú÷@];î,|QÆR6²º¬ÓæwKly9ñ¶®øý1!H)µÝ4J%×a3©4_= åxIUjåý\-0	cà°Åy=M¡ÖE»T=}ÉÀ1«Uþ<Ë1«±vËY´R]o:Ç1«ÕJ·ÓÅZ>ØFükðóþ{åW/Ð¨
=}|Ö8ÅfR'Fð"fQJ½ExNàænL¿=}ZíðzdXcfôm/w¿ÿá= ¦û<ÝZÝþî:­Ë³ÆJX#ó·ÌâBÜÂ-äÂOñ¸Ïfs= ;ál¦ÏhéÚ%·Þ,hë´c
GñëV|ò9[J§ºàVåÑôÂ5§ìE!_0©hÏA* - {£;;ÖºPd7ÎîdZVZ¬5ÎË×jÕ½ë4Ñ,KÄõÈ"6C»OÜ¹|¦Bnq1Çu¹©5ÈF ¶Dë)nµzÝ?ÕçÐpÊ0ñxÆ#Iå¸öÉÅò$Ì°¾&µMKî!2 Ï¿3yòpÁ¦föÔíÇ¸ù®ÜlÃø»jÐV²/MétSÒ'[#»:uÏÙDlr!=}»C6¥ª¥·%ºrE;âP¢ñnzù¾Ý@ùë4·5>´²a.¡ìmHÿÌáÍUi·ÍÎÈmNÖkôAlz©û!åùvOÕ4p?¯ÒÂ-@ÂB|åá9~II*n Árâgîv#<BF õ_þÈqTçºÊ5âz^O¨Ú8sC5Rì-LvåF/·xõÀ{Â°&ÑFrÔ1?Uî½= z£PZåÊøH7zÒÚ[Ã+ÑÆU]?jÎJà' (JPé»ðB  HUª@×­.¡RÊJÆu]¡ì¶÷Cÿ°ÃåÄv)/ýÁÜ©)@eê5|oÐl#GÉ-(¤ÃÞÕzæþ:O
Ùìz}"ã8D{_cÜqÄEýämïI5fñ«ZÜ¬}zFÔîè¿J=M'c¥1W~xYÍë}×¶È÷ 1]ÿ¯òµr.ºâHËÆu6ú´Õÿ4Øåá?ð­?É/Ão©OzEü2v;ßÏSRgGc§l!U¿GA©dù¼¶sQÀ5Èn
 Z9= c AéºÃ8ùß;a¯%a=}Bõ	ÃVài³þÕìê!|!Ï."oYC²ú¡@·¶5:=}ÃOGÍ7·¯Ík°¹TbÅÍÐÿHâô¤ô-»Qlí¢8cýø¨ ¬Ë±¥ÈÕ@ÇÕ$!EÈÙyð*'ç]Æ%ã~±¾Ä@xÙ/Êþ>Úe·/½'®æ8m<¼~ÚV¢ûËðý«±ØTâ&¬xg| O¾Øå£l?µÍ×#Ö#8ôSµ»g
Ø¯Uì#@iÊ]ãö'\5¢7¥Ö_¸ÃßÔ=}«n>rÇ= æ-¬H1åøaÝ«Ðà¦,ßu!xV¡A÷üU¡ëÆVüÇßWï­¿ìU6oÅzoÆÏXÑ_¢Ì¸÷í\!Æ	*_|KÿþÑ=MG®-,!iNýóïWji}¿ÅÂ~þ¤É U/uÉß÷§C ¿òÙµ´M{ª(DHK¤l;z¼é_Ûu!!ËbE÷|U¡5Èú0ñ½uj§éODú°¨â#!í,rÁ{Èèwb= Ka¨jÁÌgz¾áÌ Ó,Ðó= M³p¶rôB²Ã´"yRÃØ½tBàD%µ§DBÐÔêS:øÞÁ§îódÌÒMìh§¯aq´éÇ!´J¡ êÛEÛwÔt²@7÷vÞ(ïXÛF:"£äD¶H§H·TÀ«QaFNæô¤Þ´á£º"Ï¥!¾º©¦D	öÈÇËöùËûÖð:ºýÍ¹±ì }Ïè ÑüÉ[Át31§:¿Ç-âbw¦d¾Ç·SÞÆ­1 RF¸?ÜZ dä"åFNæYvØVæEÍ÷^ÀrbÁj®ã©°ÏÃd0,.³w±;ûñèU®¤1:+zÿôÝ#¤Ðf=}Gþ\¥øxTÓ= ­ëM.t?F7Ð]ú*(_J¡Ü®@1CôÅï
{gxbbC>Q²ÍõT{qûúWòÅI%?:= 0Epf±z$¢	jFvdyNÐÜe;÷<}¯§¼;üäîý@Ý|ðìÍé7,y}ì1ùót«°=M§øà	¾8K[þ }ðYBÚc¸£ÛQ(uè(M^êÌ)C @i-È"'ªÛ°b®NiÓf-êbUxïvSº$Úì7+£V:å=MØ6&c÷;¤ôf=MO?ä÷GüQÍwxA2ªIY±AÃo9|¹Ï¡kx¤LìQFÏaÁ½Iwû¢¥Ê7W5?:ÕÃ;¿;ÝAÕÛ4?6ïæ3myv87/Vóà2pÂã<ôÈ¶/¬[5I£@ïÔÂU
2ñ°ã¹Ñ3l| *Ø?Åà0ÂgéES(WfÚ¹°jlHÈ£þK-¿Ðzæ/«ÜõùÑb¡4Âå.<æëBàs±p#b«Ô,ê&90sfæãð¿çÌtÞÐ*l¨ño¦xlJ*¹es@c?Óù$g"z= EÂµ4@!D°fôLÔD{é¶KÄ6ùgÖr©>8Åë] 7ø.T çÂÛmRAlQ«U.¸Èã³¦­l»ð&~[í¯t¹"*¸srév²Î¡u±ÇQ#tIhc|$²8¹ÛR»N& ãXtmV770&çtV»³´pÓ)3l9ý>ý£é¡If5[1ú v¿]1ÊÍÎMóÑMÌ¾tNäÎn~Ä:çnuÐäÑgÄ3ÖÜp¿åJ^{øêZCÔ¬¸¸h\©¡yÄÊ%«+î k¦ßîÑÞ>eGU\ù~èFc.Ñì±õ¯ú~ÂÉÝ~¦ó GMeÝ­(n« ~	Î÷ã¨+¿aì î¯28ÏÆF1ô¯Ø÷ü¤Q>Ûû\mAá èáàÖ÷æ& åI(Ç»¿÷EÇ£L§ÕGxvÍ~×ì³ý·Û¹ «çBøèô5pþ¢¬Ð/Õê(K¬ë¦yÙ,ú6üwÑ?²zÂI¤¢©\¡ôa"°@ÆõÝõGÙÄz°1@©}ºMqñ.hùvÕ¡Pø.
Í	|ü¨°N	á'ð-= PP½ÀÆvÎ<Y>KïkáÜVOÙ*
7Õ¹ùèäø/¡ËÝ= Å^Æ;ÕR	®ê9¤Òu»c%W1ý9UTj§ÓîÖçWÌ ,ä)á¡ÅyÂõOtÇ¹Uç¡½U£rÊüëãc
ã£> CC@hå²àÊ =MÌ÷hTk=M(cSàiy~h@ñ*»(*×»¶ã¸}8(¸j½½Vh²òWNÕÁCU²5²=M%		õ	í		3	ùùãyw
×ÛÎ%+¤ÛLA-ñ9[© ÖMN? Ã?÷±ªÓÄÈ=M5<Î³±äcJM°Ñ*ä{Â¸ýè3­(¸l"²Úä4ºHI¼RPÕøSz'³Iþ^ÐÎÆ±¾«CRvkVHI¡±¸D¦Ó¿¦%
µRvá£¹¸l	ß³,lí¿Òp¥½îÝH6råÉsgJmT®K÷ÞÐÉ{HI²ÊÛÚä}=}]})~r@µ7ÚTu´Åpýjùÿ= _Ïï§>ï+Ü£ßã);áÁ'cÒ¥~	sð]L"nf!	@ú¶¬¢Á´HÄ¦ÁÚ$c²EEæó ãÐ<L®òCÅHû)@6¡#þCÃXXÎÁÈo¼{YÌØ«Ã5ïowDDÆ!>=M«¹NÃÔÁ§,DÚ@{@H}ªx£ðjÀ$Úu<CªóN:AïGC§2^¸ï[ÝN«Í= õUF¾ïjy	_l5¼@:>ß©z©²}JÏ}pø³¾qtV'$£³¦°Ò¤ jcâ±adÆ:ÐÅ<nÒçL9tÄ1&yý'¨ÑªIj¸Qy¶-ùÜCºÏØ×¸8']*_3¡É.Ú+öCÅÁölpøU-³&Ä$=}\S¤½!ð¶î¥#(kçù8£Ø¤(8YºÁr4LdðAËêÍþï¤íÐ¦êÃØîz@±)_®îb<×ô¬÷gbÛüî=}gÈi{n¶by°8ûö­¡høþügz{Ñxó÷;?ÂKª·@Ác4 =MãmÊy´uiÒ÷9xû;Å 3=M÷ÂÝQô£Ûøö6Y0?{gsmYØÂ!(ä×N)Ð7f§æáoÑÎÅÒi§#&=}Å±8­Ìov:þÖ-Ø6þ.þÇXäÖÐPÍÅQ:Ê4¯ß{ß2§·$^D¢ÿ»d!Ëd®çl%ï>eh*öho4j´£J$W?Õj¢ìÕ.;áW¹¦w»¶z->¨]vgsí©¬­=}Z«M=Mß£½Î«J8Çã9ÅJSJô;^°}õ¦/Dw%¥(@öaB¶µxù]?®´çL@S÷Ï@/,×§ç9kº	VSÂEÖÈ¶ýfõdCÖi/µÿöC¿£BsÚ²³Wª4'sÊ²ë&tBý/DKú¸n¶7³qÿ$Î	¬wæ;Ø³³¡tM
yû&±a¯ÑÈR
Yþ©3Æ±}ùk¨Y	¥»uÐLí5¹ »¸öúÔWÉ<¸%ßÎÏp2Ê Yu£D2Wl´ÿ41Zµ9Ê×M¾Xu®÷¾g¥WÉÀgÔ!ÒdÒØÇÄÀ5=MY/ê3ÍºÏ´aÌÞ%Éõ­ÄQ}n|Ïwy¸üµçÞ]¡¥	 ðäeXõLl5£¹úø3ëFñÝT]ÕÐvì%@dÐãQ#U²;f ÝÕ=}¦}#¯ôë$»:¡,¶æcþº¢JàÖÌ¢áGm"¿ý.XúÀâ]Yñ
îSx÷"¨Êâ;¼ × ¤í/-Ö"ÆOÄ¯ÔaÃ§hîÓcÖcQFóZ¯$Ø	Ù£WVàö|í¤Õ©(éyâ@\ûbRcÄÛeâñ¥qø_U
¾/cUüõF¢9KöÚ¯&X6ycË=}SúÛÿ¤ Ä0<ëÂð=Mþ¯'á®­¥TQ&!ésCtKê~\*á;pjeã²0Uí	ý®²1ãï\QÑRj'E!WWöäú¹0*«¦izL,¯!]AîjÆ ÷÷öÄÈ>Úkü&ÐBKO­èÒ@qsç
«£ª÷YPtw ·6b¯aòì¨v QäÇ/+ðÜ<bfò2Çñb§,ñoóXÄ­ÀQ
u§²e6Ó	ÂA4¦ÃÇQþ'Ð¨©Èo GvÁÓi§½O²ÕÒÜ;ú¿¢C5ûodîþ}üXUÓpÍÁ-?o22W(+U)ÕÞå.=M«[i®+®Í¿x«vMùU/ûës"d#ßöèôî?7t³wñÒ·÷Åé$û\%*»%÷jÚë·i>Îº²rò=Më²
ZªX·|¯­û­ðìÂª¯8PRþ~¼E÷_®BúwqëvÅ)+³»7Rvj{£j}<²ª2.Òè·TvÛ3TmK)Y ]xßb»V×óòÐs³°ÍÀtÛ£[ô¹yÊLrsîkD?IèWäC¥-Í¸ÍêG½ÿ-§kEßÖCo_ä?ÒAÌlPæû:ø£ts8¤(WþËH=}¨ö\=}ªT÷¦u¬(Yý«ôLBrÝ9P§NVZ*	]bÙLÊµóÌKÐùÖÓâËWÀ
»ôUkåéÎG¥J_¦&^­fÜ º_EÊyÊFÌ¿ª>Ü«´óD¦ nºN©3Å\:ì5*v³È[:Mî-(µ«éfÔ=}p¤æ#ÈmÜPÊMG-FôÚ«rÒzM¨' 	ÊîD¼ib]ïCÔP~©uY0¦+²ü+?¦lû+²Ñá4¼_êÑ"é§&M¹¥¬»S(-ð'Ñ;Æ2Rê½ñ3%Söi	igÓÉp¢ö3?­TÈ¥ê¹{/=MIeùbÊÔ7q=}£Jú_Y=MN9/Ï3r·d­ôAufNåÕhs4ï÷³píÉX}~&n ªÅ$
ÉZ#!ÖèÍK*þ9ÇÆ	ZÎìÅü'Cï< £Â+ÔF«õ:Îúí?Yc6Ä¿+Î°e×PÞãÊÆÿqá?-ol_&=}Üëê~ßjLö¥Ï(_¹çØ$ÑpÜzOÔJ]=M]¾</^04Q½¹»$4QeTo1<5çÍÛwn?Ìí7[IÐGùØkÀO]PÂü¶Ö¥Y7= :c¼ût@³l»Õ
°7%¿LÜn{?ÚúHÁÕ;MäÊg)¯TÐÐQ_¼ëV3ï£ËÝláÌnù¼è¯*æÀ¤vaH8èÉ+æC<Îð¬-üjf!òüm ¹ä/¬'@ja	Äõ­Ð¹ìÿ¬±X¯âq<Be'e¶P-¡¹P; CNxë>Ýÿ4ßÚçóÍPÅx¬¶ MôÜýÑZóÃÞ7GÈâ§­"4i°Á¥!W #O£±«ä¡ Yv²Ì½ÀËnó×¼±©ãÏGXBiµHÝú?=M¯û½CÇc°8öêNÊÖ¥
tl£ ÑÝþ. Ï$¼Êyè#s­ÿûâÛ,àðSc@Tès/¦ ¥	h	{âúÿl-m¡¨:ùb^ôV1Aøón{¢DDäÞ>m ÏÀ(¤´'BfX
>.#­ÆIxHý^gÃvPæN<~áyÐó­¢£Ê9èî|m9µ±êª×0Âç7®!|S4&£¿æK¤@z2BÝ;bÂS	î[ÂQG=}öU¥Ã±läüqàaµ<XkÆÿSÁñvEixdïrPØLò,UsÁñìu«©¨µ+¡¶xô¤~)!}J
fd"õÅ=M²;úlë²°5}fmã²±ý&Û²4n+ùøsxacùÝãóa[ÑÙ=}bì_2ö«b¼eHG!µûM¹X6xmjS¹¨ÛqíaÈçÿRPçÎÅ =MçQ#Sq÷Ùi÷ÒGRqÐ÷=M]¤¸"lDOÂ¥8,lº]B<÷#Ð9ì3¹dìª£=MÇhãÒpzpg+Ò õÅ!ÇÔ]ï5Ó0°	]K*ÀNaä9ò8%*Àu¡½Ùò<>a%iä]o*Ùä¦o²ÚPÚ¡¢.ébôYü´ÁNèï%þ
nVÒv§z þX&Ñ8~¨Ã^oÃïo¤X¬8¯Mï6¬£Yoºêþá'YD5Ñè§Ëòo·Y­Íïk§Ö·ÐH^®#ÝÏ;þ'ÐÐØíßªÃ«WI~þúX|Ý©Æ÷o¶þßÐ¹¬ÃGëïµþ:ÍZ~VÐ¸º©£Ïoæ	Qw´¼Nþµ2¶®))9ÖÒètªrº U0Êj4´[6.N~ßQÏß_Ez9ìv]U©	v¯K»Æ\®¹Àb+m,kL«wïu¡¥¼ù¡T]Á¡5âÁc¢Çe%O÷ê7æóêÎñF:6é#w½ñ¾]Ó.X¡%Î(ü=M²*üÒÉK	úËª¿Å	z?ÊÊ~J*òåÏÅ%×wj*õ6iJ¥{$Wå$ófÿð¥.
_6Ú¨HÂ#±´Ôw¯kâú%­!})5ÿÎÐNÕ(í®°Ç¬h³ùtsÅÆ9SfIÖ|{pK]Âª¹ýÕÆÞüü¯¹½éÂÊÛ&P&ñ³µQ¼ÕÈ4.w3¬|¯í+<¬%EÜ«	<®¥ü9­íÛ~ÛKeÛsc3X?¬¹-º§
ÃN,¤9ÕþÃtÂTB®SKüPÝORË»ÏR-o_»R=Múàgï¼®È¼ZÛ÷·ñ¹ªßw7fM.pCï$ê!;yÜ4EÿK]Ç9ÕÁÞ<Y6ú¥ç¡g×¦L\	Û¢r=}íA_vé8¢[2¹iåê¹blIªw³¹§{¾¬¸¹wMü¯\ÝyÙÁ Æ¤"8Ê£PÖVú{kùþ£^®jCæÆ÷	LP1æ{öw£.pd4{¯\÷Ü%L"ÍòÁÓöÙ	ÍÛ2¨òÊ7c­8bÌ:;[ëøqEQ{yÖtLPÚVU#ñ;VF÷ÛØduJÎEI++ ²ÖuwÏ9Ñ£Ì>¤1E·Q&¿/åV¹°YGy¾ÓL¦h+/¾õ¶ÒÌúSQ©ÎL­*ÎÊ9ïxÇ£'k~n#/yÉë6Ãõ+Z«òGãm=}?¸!kÏL±ÑvÏÙc=}Xº¨f¥ßFu];¸¬}Ml°©¸göwm·wØÄ\5nZçª³,å6µâEª;"û5ÉÓUj!&:ÔT~Þ¾o¦Ù×±ÇTª"ÖN U%J¨ü NUã)RÙ4ï.AÐÒPðy0ÙiñD@O&îys} r>ÿVÛd=MjäÔïíÖ!oý¼qüq?ë}qó±¢üõ{ðÉ}äýË&ÍÏ¼I&fí´ÐÃ]¾tÎÆ#Ý¾lLø/Ë/.¡s¨³ç²©4ÒMê9ñ"ý£¨È]ý®oÃªÙ}*7¯%¹	j\+©ZR¤3´eäs~(Ö©T×+ê=M
*°°ìÒµ«ÊLª:}+gÆ1ö/ÓHÖ¸ÙDB= Bör#³":ÐDñå6=M²M+htJv1y¿´Kw/oìëHLµ^»'«Á´êú>rþöÆlµBÚúºÆvæMsÕtaÜ°mÄÑ\ó­yúoM;©[Í²>}2W°y%ÔPQ>(®x+ÈØ ½3SïµÖ¹+;×²Ú]´ÒVýKïp½ÙJ:.ºç
HÞ®*úÑ e$7÷ÿÝ.&Ón3²´ó4ö\r&Ú71wÏ	²Ö-ÑG(5Tvú'}_®s¤Úâyz?Us+DÔMøXeüìrz¾úS}N0Ú-
2%Ùª4ÑîU¨¿¼×¨:ÎÖY æïIr¬¾Ûh¼[ÿ3[/µÔÇ´»Ót\[15ÏSÒvY)=MÈjÌKÈÓfn©]¿q¢[zØaþ
])
È{ÊG:ÞeÜrÖJÉ×}¾×÷ZUÔ¦~úlú(^°ïûÒsìKÃ?TH$ó]Û-#ß0UM{b6ÊK{1ÍôÌ´!Bw.ºÚ+Åkn{nÕ0i'=}ùcjòùq%´þ9lÍc®]P¬,î×«!¾vÖeijî¨#­*áEêIhÆ%ì6b<é~¶ªðvCêÊ«4»*õEXNfiç´P¸"ý_×£º<ã×I ³4óö[Ñ§8ë¥¥:ø,ûÅ%ºpÿ¼ïN»ÚAqîÉ= ÉÕ'·ºÞ¸ëcu(3³#¥ZoóëÕ8¦àYæºA= ^ùføÛ»ðASm®èê1ã0ÔAàæÐÙ æì¢´Ûc@ÂøGìfí!4µðDºí%HÙ0Hxî£zAØJü
Kf;¥øÇ÷úC<w*³,0½@b{& ßÕèÈåzBÎý3T#®	lôx\zæ:Gmåþ9>Bi[_ÑºêÏ¾8AÄN8#aÃ!ûï%ºæ;|0þi3Âq¨Küé¹ùâl^ ø_2ÕïêÌP[kýºc÷»¡þÆñî°Ç= ë¼xtobÛà'ì¨W$E|°Ó¤éG¼}Òp¢æàÙX±Êâky"èþè± ôBèë$h´_Å@iA¸ùf;äÃõä!ûÁÇ4 Ò ñBÂ7ÊUe¼ü\ÇfTçWü¿Ânòùï&YÀnçöêA¾óÂî/Ä&lf¹±À-H÷ÌË¢¯ûË
Áæ%©CÛÑøä¸Û\ï
ßØ @
nl%¦ÙB«]?Öc5ÿÆ^Ó#hÇ´ÍügÁ½Ã óþkom§­éx÷á7¿piX|ñ®o¢½Jò^|d±aØÃ%aìÙ«àë7åÒKàR îd¬ |ôå!K5ð´çÁ= ³D´Ç/¦Ýsñ xbÌå3ÀÞDêª'ä
øOäÃx^èV¯é¡sh6èeôç+"Q	ôè£Ã¢ß¥ õå1TµM»ÎMÃÕT3»M»M»¦S ÑË])ù£ì?ìÞ.ó+Îüxû+a÷Äþ§&=Mn'Ây	~6Â¬k¨X$ät0âW°9µ:^,Gn7>®³ÂqnóÔÉ	:/»Z4ÀÖùÐMpÃsaµmðRXq7ÿlLB= §$1ly,S÷x_§¬öÒÖ0Eew=M,IY/E:©ÜªªÔÂî§¸x©&3êSn}Êþv¸Q³.ÑîP(VPKmcMïü´©ÉsÒs¹K|LÇ¤µ¥uÎç<,8ÌÂÙE÷¯2ù3£­-c{Óó½î¹Ø®­bþJÓðt¤ÑÐÖbg_DÇE6ïwÛ[¹ª+k>)\È«ÙØ¸­'%Á§2ÿ«¯ÚXÞµ§u"^=MÝLSÙ9¹/=}^öÐU= .õãÉú@G XV= 'ÛãYòÀ,z Í
ä1åiÑçY(M!ª¾èRÑGpªå"Jø9\èúB©¼ð#Öf¨WdÑ¯ßð?Ý#Ûd9þéP*xL{¢Ôß¿d©~¢2ñ¶m"%Åß¢ÄÕñò.%XÚ"yòÓ)¼±c¤$$iÉòÃ¶+Lß$ÏòK«<
,"WyVyÝE-uù:ÆÝáy·Dvq$9.eáEõæ4H¿%Á1|Ôÿÿ0T¢Õêµï	8È	tÚ	}*zâ
D!Å0'u¦é
£
ÚÃ4*­3y6Å¡þu/5¾2É×2ÅÇWuÆÂRJÑj¦Î³(·'u9Ãr?£¿/ÃÑm³z¶>Ã­má§>>´S7¡ëmr~Üµ0³ê>D÷4
H;&°z #ã¡öbJ}äZëÖÊäÍb­á!$óÄúx&Ð\j ß<!ÙbKåoè¦ÌñÄ0/ëî<ò	XÙ PÎ@Ò!bcß[r'émStm®ÿ%	úZÉ÷ÞÑ=}¯à  áðfM»¸»MÞL»M»M»UCþÅ¹(k¯	óêzã¯cjô$åk4±ËÒ®7åEi¶%éúö­°6H_Tóº³í­ÌiúÖ%çU#0ÖñH¥HôNéíÊG½±nYHÑ"´Gé
ü]?É¶ÎÕHÝ&tBëúí=}¼aBÍ&%×®Ý·!´ßÊ^ôµnR}$Á.G0oS¹åÝ³?&'Þú:Týei¼Rý±mÒtÕÜà_h"=}ÿ/0½Îß×ÝêØâý1¹7¬K¥Ê!¡¿9vÑýºG¥¿s6ÌãºCù¾"^"-ÍÚlº»kÔå5VµB]%EL= M'öÍûªIíL=MÖ¨b^'ÑõÊ¶²Z¸P{JëMmMãV¢®»5MïÌi·Ö¶¸'ÛL?^ÝÇ{yßØßÕãà?ß¬èXfë/ª¡ÉÎ×| [Ê â:âl,ÄÃµ§àD÷fuH+ §HçÄcI<t¬æ!u«IÍ¿XÕ¢åBñf^ý1ö
é
$¥2,AÚ/P¯_Ågz pßyx01k&YÊä¡ã@=}éàä CM»ÑVK»M»M»M»}ùm0Ág>ðüeÄ©¢ß¡¬3X2Ôï¾í¢c{PÀØlåAÂPIáªü"¶¢Ø= ¬°QÊþ#Ô¶pÜ^åëêN£ÀÚCTÔ¢RÏ/xþÝãêñ_Ð5â¾mX#ñê÷4¥8ó£ZUQ×~ñöÅ{ÁØ]KÄÖ¹¡´åkXXnÿÞIï¢ÌP¼ioaY2îvÁÐü8O¤coEØõ9mn¥mh4O#«dþÐÄ¿|Õÿc;ç0YfQ¹(KmÁþÕÑi3¬Òg·ìª®Æ~nY´hfGvÒ= ¼ê¤Æ©ËÅÁ~èäw­¹&Si}ìK¿#±ã¬7§	ÚÛ#4¯±PÍ.+ªUO\Ã=}NJZ /HÙÝå/ÁEÿxÜë_Ú.c7IÛÌ%¯$<Ô*|
ÿùÓ'zª4sÇ?%j³5uzsXTöÏÉPjþfú³h?¶zÃyÌy·D-é¸-Ä %.|¸u	¿¼Y³s²{\É§c_åÒ!geR¸Þè¦X'Ñ¨Ú8*¤3BUò×°gÉLê«DÉ¹ü4ÄÑÏe<dc¼«H\r}µüL>§¤³mÕ_ëEº¸/ðà6áààô¬M»Ü»G¬M»¨FÅ¹]°8;@8µ(¼-æOð¶&cû¢eË£ÈÞüÍ=MÙÿjQ³§»BãçnÇcÊä-Äk¼D&4/AÔF4/(NÚ-È4}£ÁaÓpx¯}Éë9ýhÄ=M+¸ß]	ö·wó6âW5¼yfwKñþÏÆí$L¢ZËöÖß¿ªÍÍ¬:sIâÏG¹þÌ_Ï£HKWüDC­æÛÿÐÚ-¡y´s<­ÚóG©üU~ã	÷°d±µ<{_mjË¼]Zó[»¸|«ue"të>ôAOQ.tßI´6«ÒZd?ªõo7BYdêæïè\ÐèÓ»JL!À=Mq¶Ác5Õ8¯2ãf+ùrFdh-"<ñ¥#¨lï¢Æ\ö (¢ò)ù&
:CÖ fêí;vù¸¿¢þüýxÄÍ¨o0NUÁë³2=}¹wÃ¦qJW6T[0ºëÝ¾T×Á¤!?4ÚËoh^àë½âYýû¤ºd@´k"ÐÍé¥OZÊ{8[r7R1¬lÆ&$ìê)¼iCÁ¿Ðt-w~ÚüO÷\YiXµ&/ZcÀ=M_%¾±KÕ~nwÿhÙh¼¤¯tÏÙ¢6<ÕÜ¦ÄÏ,ÍÝ!¼äöêÂx¤ØDÎÔ]SúÞ2ÉÔÓ«@Õß,6-Ú%Ç©¿úßA¤ÇüË×D-=M{r÷èÇòÏå$$hÒ]Ì
Å*BùÛ4°^òUÏ
òª	9?+:ýú?ËIÿ¿¨Î;-|îKF%[ë©g»ð8ºaÂVxVóµ£ØIÝV­ß¸oRììâáPÖ|M»ÜfL»M¹G»<M»U×Ðßá[ãAðÖ!c¸Ñ@ï¡Lèïî¥PÆÆ¤í#Ä½P=Mþ¡¸¬ñ4üi¹f1ÿe{¡HVÏùc4Çø¬}å_!p7b"åèqÚ4øåXEiÀj Vº¥WýkÔQQÂ¦aÁ;RY¢sxù	3tåhÌ~&»= ÉLÜ}ÔÇ(>s	Px%ÔL®|£Ü¼Ì~+´ÉY¸m{/VÒ\ÎIÀ¬±e8è"Añ;÷YDéÂ+¹sôG}E¼|ó60qâï³u¤=}>¥®ù7zMKØÛP=MK·ñ¼nÞËyaÓÛ2iÐl-Ô;L&ÍÆöþ¸j+Û6äLCfò|.¥ôéB*øÊ	iÖû	~Î¼nÐî6ÅÌ °Q»%p¤NìåÖðxgMn[ùÓBÿ+WÌ§"ÔàeçXÃYp¢og\ø»ù'ÈbS 1Ìn±TÍJK/ÐZ¸)\.ÎRj)ÿ.YÔìÇ~Å#§9TB®±JYþÇ÷¹Wqùw0H¤ÝÈ«88=}AÚ4þ¦ Ù²¨Ô*v
c»U.¨½ÔÂ-â·¿<ÈG
Oö\giFWÙÒþÝ'Ï3Ôá'Ä#Ñ#Ûâs§\¢ló/É>Ùlùb¯1^®v¨÷UX©37T($Êí¾TÀê¾Ý¿Çévÿ¸ÒÙÑ°Êó%óÙÅn­QrÙ",Ê÷dV_ÅÙoTr¥º$vâR|Ø§¥&ôÅ)*uG»þå^	ÐLyÂvjö3BòwuPl(a&§5pè7A¸ö5½5fhaú§&ÃÕ1}Å=MÊ$¾²À+¦ßJR<s;°Ð²G,iõ±Ábî[Uð^«¨*=}F>¶Ã8þ6ÛÕùóoÖ&ã¶Yø°¯pø3#â¥l(4G2mIF¦=MóÜÒ-^ºtuÑl»M¦8_vMÇjgëð Kk©úIe½÷ôp]FmALø5@£­Ä¹RÛ= ýbAV$i»CÞ³þî@ q4',UÂó¢®4QFÂ÷Â@²Í¢Û÷OTÅ«Ìª½¨Æ®ÂW4¯ZµãÕ~oÑH÷®¡>h[ÓÒÏØËÃcßê?Ú<\°ï;v­Ú¦ïO||Ü}æ¿é÷ÛaÆïèÜÄÒ/Äfß¢*Ö÷Qã_ÐÑ÷[^ÓÏÕÿ6ß¡Û¹?VÝÒÁ¬JßQÍËÝy\à¡²à$ãy;ø¨«!¬íÂ§Ù@fGåSd¤ðÖìt§¢ð.ìØPQÁüø¡xè¦ÍoDT4â[xöñ¥¦½±<ík&OGìI¬¾ñ«»À8ÒÂüô'tD'ãÃ	r(ÀC âÓò©Ð/$7iÓÞ)õ/F_µpÕe2)Þw*þIÝ+#(}UÞÉ(kG@Ì!XãYq%X öÓ1í¬+g'!´(ÅÒwÍYdÄ[GáÙ¨Ì
 = ëYú1¨Ò%´'öÁxo±¥ü0¢¼¸òZïvrý7ª£E¸t^|×)Å>a,*å÷/6RÍ_Â\&õ7®6SzÇKØp3cº¥:¬ÓJÑ<'(!ý97ËIGt,ãS*ûÀ&G«ûYVéª¼Îó5½,¹öæ·ÃA;ú:Õm'-MM§}ÿ¯hKËÈE=Mý}ìY³eHW÷³¿U{õÿZ8»¿£Ú/ý¸§ª]ü¼¯¹^ôæíðÏsúÐÿ#Äà6gâ= ±Ì6»·~»VþM­ÍM»¶¯¯ìLPÂÒFÌN®Lu3¸Ä¬O;}QÕP¼e¶F÷°ÂÉªeõÃ=}y£u³>NÄ¼ø¡mÕ½PÕQ'V^K:½ÏÃ!j¦ã«ï¦Yµ·sÍú//Ò¤¹Á)÷y:ª[a£ëiòs	QXsÊÇ#p¶gGs\±Æ£ê??¶Ø²ArÙMÖÑCeºo!óÝ¨NÕÃd­
_Ø³£î>ÍXH'=}+¥àYàãzâài; ß(âY6ÿhJ3 ¿ëô ø > = ·â^éBÉ º6çQÜYðÇ
cx«c¹Ñxå\dk#ÿ¢b0¶ÔíE 0òNelî¢XlAe3Þí§Z|%ÑñX^úaÅ×è^þ¡Îh(>¹)Þòî$Bö$Ñjï$Ok²z(%Wû9	z.tµ¦PADì­Ch[ò£|r8Òç¤]^Bùrõ§ÎQ$-mÃÓQ\óÿ¯zoÃÑ+Wî§Óag¦ä/)a~iìt2:w¨miÜØqrÒí," isª,Æ»®©<Þy³©To*Á[ê-A·ÎôîÙ7~ªÚ4Þ<wª= Ç4tQ_ú_¬-Ú:úntTìÕTRo³òt¡á=}æ!óðO©Ó{ìf7ENP£öD²Á&I9Ø^q%ËO9l|%l {ÙzL*zy{ ÷¹T­A1¿üN®¬ÜBî¥Qè¿¯Æ»<ýØXÄQ|^ý~gZQþNÆ
=M·Å³Ïw\ÖÏ¯¥= â^þ3 ÅåÎöpÕýêÙÛ"Úÿ°hS¦m	@Yñ3ÎôÑx×ÆkøÏòr$DíQAé~·*q0ª?ÏwBÚtÛ»+[3ª{ZÕ	C»´â/uè	|ÚRú6vÈNÆÔêÂÀ¸×õ´5ðÎ2©OõuØ×·´*6~ÄjøEõ%C=}2%ºÕ
¼ò¹CE2û¹ÐúA.[Æ^±þ¯ºW¾fßªJ8¸f¹_·ÐÍúØ´r.=Mçç¶²G&=Mï/¶²5à»D øáY°Ûléó"=MÃøõkdDJh:}h­Ã$tñÑÕõñ'¤ØË¥Ä´i8ßjxéGò^ý!(¢¾kòTÁ2vXnr{Ï9	í!úÚìq}£ÝleRtR:Û¨	ß;®7ÛÄÌW1Ð8!XGå1
ÐºÀÌóåßE]Äºä7	Z=})!jáúõ_n4TÖ~0ÑozµJªZÛz!JÎ3ÓAfÏK¶Y§:#¢Eí1:>+æHIÜ'+º>=Më?Û<ý-ÿÉ¸!g³êýwUeÈñhÕ<ÏG®ÿZ¾O³SÛ~>Iæî9ìµùØB~aÆóæÓ´(¯î&*REqf&"-ìõy¸½»$ 
y°¾hsÓ\yeßxÍSÜùMjeIæë·'8è{FGewöäÉ6®zÜª*µT;Ö9	[IÅ»ûgm<&ºhxJLomw/MrÌHÍìÇQÍìO_«æ q ØM»Ö7»:»ø/MOM»M»MS?rA'.ãoûúØøØ¥ æö@.OÄ;U]½&>m²@qam/HB[)óËxø¿«dYit-Ú@PîCËyÿsS|y;­CFBë9*9¾¾¢pþö­ÉheO¬H[Usý6ïTõ«Y¹:¹}«&ÓÚÖæLÄúM£¡¦¸öß }8C}V2n\s}·Í¬ÞMÇC^çÅûfýØ§NP0Ójcß_8{»)ÃZ.îY}tlÉ²©.®WRsk£5=}¬×QÑß÷Ãî(Ö¸% {¥½¼NÁÆÀÆ³8¶9Y±mÇ{d9lÆÁ©#g>þ®ÒKg3WüÞËA)BÙ¼>ïÔ2Cw%ç\^ÈLÿÍëÙÔ±ºËØ@ÿöÚxZ°'©gvÐs= ÿ#}^vÕÓFnyÝÜtÝÉÇ*ÖàJáNUî0+= ¡óãL:ÿÀÔ¹àG>ç¸v¨hÂ!úéÒ¼û$ÿø¿SÃßÎ Oä¹Þ¨¹,®vïUhAqðUCÎêñ½ÿÂÎÍð_dÈw¬êAîîüFÙ°öd¬ÅËA|£<*÷<è=}{$8Ìn/d½³½ø§yèu'q*/tµ°*,hS8tÓ¼¼ùÅØÅÓ¿&Q÷(90@N=Ma|}åæ(âÇCâ©÷ètº	0Ír É·ârh<ª(Þ+byçhh³%¶÷U<ÄÝÝX_÷q>BUQiPiTiÙ$x$ßòG(1Âô×s$ÉlI*¨<¦ 3&t¹8Ä,yñËEüu)\'Àyò	ôRÇ3Ø>9A_ëåµp{¢t1ê)÷X
PË^<Ó%Á4
ÿÒ|*gª3-%n|2_ª£
Û¼_ÒÊ_mgyî÷·x0;Ym>m½m´¯µ8!ÃµAm¬·jj×¿Ø}!Ç5}5UÌ­U9UÚ)ÏçÈ}Ci®Mÿ.ÈÜ_Ûÿ#Åà 'îä°ºM»M»Ø«3»M»M»Æø^éÑÀk­Q"É2ö¸:¡Hku}=MIk:=Mf®8¶B»kmÇ=MFÈÙ±/{[ÑL4Z{åL¼Ò·Ë»DÊ@³¶ù´F¡4{¥+MOÉ]´Ø5{¯/LF\©ö¡A5\gÉý\î«\Íp#>îùÛ¤ýËÐF£v5î=}W¤ÁÀz#zîÃêË2n+o43RÆûÄLwÍ=}e<ìP¹¶¦Lw<OS¹T¸²%w×<Ä«|ÿ¡hþÃY¬,ÍÁÄÐ3´Ã/åoEU*Ò±=Mx]ÐåoßZtË7Z¬¿ÊÙ§n¡ß{þÃZÝÈqÉ§­r 6úi¹]ôÖÉ4¶G7ím]Ò×¿«ÖÉ´­äj]2ÓY¡ï\¿Ôû÷b»Ú4ØÀÀw¯{èjõmr
¼ÔjÁõêTù%«JjÜíô:
V6í	ú¥ jß§Z®0|?(:±QkB®>¥qCj[ÇõN>4¼X¸Õ9Îo^$-l8zÍiÕ3K~D¶T¬5$3lF6õ­zl-í»JT7­¤pF¶,ÿù*³Er´-Ä%z£mzäîHÒ}°)U=}Ð~ÆÚ3-ºz6?ó^Kf|kJýÈiíÇ3ùGa®íÍÓûôMø;©pÁP]#ÕFf3Mìûö×ÜÇøJú£af³£í§úr/Ä{E 0JyÀú#z-fì7×úÆÿIh_¾Çj¹=M£gÛæÝØßª°ÓcÁ¦7#q¿fAd{ñeD±eºQdéeÙ©dýeCùd39edÙe%äe0prPz0aPi@ôë®é1ë²;XNë5tÐQ0XxÀlò6nó,ò/óÂ¬ö²®÷=Mö÷²öB÷LòNóvÎòÚÌóêþê@üõv|ôJ}í¶÷d7d4âXeÌ×cod¯d!eOd²ÿd©e[¿dTdv_e)AÞqF¯= b|AôfC»MM»VR¶M»ÖÎM»¿ÌX¦yÙ}ç:eg8çüA}^U¹Q¶UÂôËÒ³¯î·
¿ê¨zVÕ¥õ¶m7;m·:«O¾¹ÚKÍý¶SÂ¹[ÎÎKÈ¶Áo;¿¶;¯9?®]¹ÚÅ5ÌUËÄ·¿G\ ¼§¶-:O\NÙ+_MÜv>ÇÙÿÈ?ÉÇWKË¶Âþ¶x>¶¯]÷Û97ïÖûD¥ìî¾øN}²*øEíüC½®ªûOíxH=}¹º¥ZUú]/y¶SÝÇ§\VáÆBËÆ¶E6«RËÙu¶56»JËq¶U6²ZËtm¶ë{x]O^U¶VËý¶Gå§*ìjâf ¸´¬|cj(j¹¶t8«Q¶;Ñ¶Íé¶éi6	1y92Ó3ò-(¯ê³Zk¹5XgZ¶{GµA4U5aõdëÉÿ]jÃkùd8¼2JM¦ýEÌQSòw68³Q<Q£»56NçÌ;C]=  <8KÕ&N&è·;£peú¿ñlÃû·û©Úê1m{¯ÿe¹à;0mÓ:Ç°ûpmºxáÏ@ð6å=}½ZøAvâõ£äïÀMÜf8f Dá'T:ÇÂjÐZAìÆB=Mâðo´ógW9Àâ<m»Ñà~¢XïÃ[Ünøb±xdùxg8eÕ¸b}è ñcäý9¨!ê1b4êµ%ýú°håHã´îã0Ç¿TÝï¶Ð×*^Þ½ág¿{ Xàèê£àxËL»º]ßWM»M»¹M»MC$OS­â]ßÚÊ×KÕßä«PÍ"[>Ø76Î¨8FPÇEåØÑÙi¾ËØ=MÙcõ¯ØçÓõiöõÇ­Þý§ÏH	ÂEwVÐï$9ÃiéÌ¸³I;¡ÅLNÜ6ÖAÛñ¶ÛxÓhuµBóõ¥¹yÌË;ÆÑ¬mEUØîk(Ö[sî®EÊªõlÙ¾L6ð-rw¦r ¡©´TNÅÞvÀRY¹&×STH»3+9SYÊOËÛVrz±á
ô!}E¹Ëô>Vo4+~0+±ë²J\#mrüÛ*9^rHÈ?R|C$	­ÈÜ@/³õ<(¹cL>Ûr­Æ r2ì)ÃBÈHýýu&!r¹Ô]%áu¼	«= 

û¿ 2X%÷} +ÎëÂ­Zñ\põ§Zqqhûm¼Q+yhÿ©3°wýFW>/w&¶âô}5diqêÆÄC{v~·#MðoÕÆÃ´£% ­2$Í;i±yKR×ædtLfÆÍ¸ZÔüÖ^§¬ôæ© s\Pö;7<¤©7QÎæÚBÎ@Óãf$Ì3d&§wh,YméÙO¡µç·ßñó^!tªÌ:ÓãG_!ÌÓÿ¨ÙÜ£¼*ã,fÁ3¨§«@+äë¸ ]ý"¾À-ótô=}AV¯ýý~p2×aÜçhç WG¶dd¢%â1øö]?ÂñéHJl7=MçÛâÓðEU¥×ìjuøj¦ÈûUHvLd=}RöOcå1¾¹m>o4¼þ$q \)1Ù®ë¯s,ðàæáààð¬M»ÜL»M»M»M»ÖÎð½l£GKE&1²úÑ¯Cy:îy'ó«y¨Î{sÙxåË³°­|n²½y\
~åÇ0¿÷ùaÙ,ùðñ½%Ä?¢r<|÷UX	j«k·¢_=MW·µa9f{0eÊÌ1¹®Û]qºebæÜw«=}ÛxDWào§gÇèÞ	'yP|GG/ÖVG7gÚµë{[iÙwÑªq·QUsqSNSÖîâÏÑ-Ýá¿ÂÐ©ì=}Öì{¡Èn¡ùGÞvëÏÙÕÙ2WXÜ×^G±r$-Ù­­Á_iÏÚ§nßLKñÀD ÇËe1¬¶ñ·k2² f%×ºø±iÑ Imt¡Qb+Gª(~¢ê¹¨Ó£*>0¦Õ~êñO5iÙ&|¶æúhKR	<kiºäÊÐPþ=MëÔÙ³= fkf¼XCd¦ÌìÅ9ù]Æ­$]õ2ïYB£Aë;&¥ºñ°D¯k9nìÈd´+Gf	Ð¡·uxêF-ÓÀº/$XAÏm#ïîãÝ°¿Ì¯ßá|·ìD"<ðá#"Xt¦oA\êb#Ó0ù-rJìcsC9	~m÷ò¸p¨¤ðQõñ­ÆóshW¬F'7îÒgÓ(u­G,FáûvõQÈ3'â*¸l×«	 _0õ43L>£Ë~:ê¶S´ámá-D>OFdCë+§Á9cøkÂ½xF×Pe^|ýG?¿= ÌçÎ9×P°~Ë3æÏÉèþààààj»MÓK¹M»­M»PMûÏ&ÔC´ÞÈø= Q¾àIìDØÁ!ñù¬	o¡8ù¢«Y#Q-ÿªuAHýú®Ö^Ïbr>j§ÅFz¨ûCxvîÁ8´§ÈÔXâ&/AâÒÒóiÕ£N®R3uaq{mµ³Ic3Frs¡¦û×S¸6g-þSÚïå¡\ªf EáëÑhÒÅk1L>l5°ò©E»E­9nQµRÚÛ #Bë¯D®J·@í%ÒKÙPUý¿7KuéûIqÑAÏF.º¢kÒ=M,ë¸ª6uM¤½».ÊFç*V@ÌsïJè]{?b/óP1 ØÔôEÀ¯]\ûïðÆ 
5çÙ÷]èYk£XÝ¢{'YÓøun3´Y|óy8ÉWrÿZðÝZz·®X·9$Ç~Ã?ßÓw|ÇDÌå>$#ÕòW<¦ÒÊõëÒK©o®ÂvË8F¿ Âýî(¶­tWØÓÈGÏAÓ.+ÿNÂ#vÔ]d2ÕþF¦=MÊé~BDÖl½¯ÓËå¢w)Ùjm>*ÐfkË¿QÁäs¿sÔãí=}ÿX;×qç%h+Ûl)¢÷*#BÄÝmH§ÏÝã¯dÿÔs§ñ±¹ÓkaºÖ{ï>qº &kø7k´!|nEòq B=M? %yôÆ+ÃE
­Y|uÁ½9r-E?nõÆR<¯ã+Y²÷Ð»&a«õÙÊ(¢J®
Iu¹=}åÓ õäâ5&Èú/óµna0ýyú¸ÇKÈaº5z¼Z¥Í=MTKTî.Rl³¥4'wzZ¶CÙú]FXË»àÓHã}DPfÎøQªèW¦¼ö! C¢Ñ8úxLiù¥FèWxòC®ÕöÅ:ðÜ¤r6+¥X¦zÑæ¶´=Mwí§$M)(%ÜfýÍ0ßB/Õ0çI 8Ì¨./'>ÍSÝóÿÎS©yëÂH-PEteû½hT£ÃbÝ«½qÞÌa@dKí¦ë·0Ö~ÓF8ycØEt&±o±^,Æ¯¹Z_âX=MpC.a¼ôí¢h%b)ÿð"hNèK"9ûõj¯¾eÑ ü¥Yñ4Ø$ÐÅ4[ªÁ7ô/&sÌò­£L	lA»·8>/l·nçÃ7ð¯­éø.*D|+'r°)¢Ê752Ï}¢d¶2Þï÷wÜ%øÞ÷;ßX½Óï%ßÄLñRÛpIO³ø}e®É\~!¿ÊìÜÅ?v%2,ökþEÃg÷¶¼xk49Ù²Y?z¯¸\Æ	À°h"¬ýê9_hª5kùdG¢òuòìNwY0åqõ(ýÄK]Fú5ÔL&zBÌ<2«½d:Ü?·QP*câËI³ ´AmPNÕ\ó½-øyóTem=MHÊR4°¦j.Cc9eý«UÂk¸Ì¦)Ug=Mù¨ÍñÉEøüàÂàààØ¹M»wÑ¹M¯M»­M»]@Òá{?éXó"Ðñ¶ò¡$t³$ùÜ:tt0ÜFÜßøÁÂì}®Ù×Â')^äAØð©¶er,Ý©x$	FsÂ°ÿ	²©?­9QùREØ1fRlq]½JR,qÃÄ!ÕÅÉ³
¯o3Òl0= êh?5Às·gÒÌ*^*¤/6B©K´uy?ù¿ÿª/1Aßúõv+(u5Yf;úó/C®^Êä¼0ÇæÇ§IÇeæç£?óm?zôEHQ'k %M6I³×!ÈÖ±!ÎîÊþ/°ÖeZxµCþåÚ¸¯2Mãæù°Z¡= .f¬ûM¨µÇf8%úFñR¦¬VªZÈÁÆõóþ{©ô¿×ì+ÃÅú
Ä­Ù>M®¢ÃÆô;;À¬â«ö¸f;ò¸rîÖõ;AT j	¶xìÆÐKÚæ¹p¿æ/a=MNe$Í¹¸nmÝÍpO'7÷¸=}´áAiãªgüXCÎ¨cn^Âh"tóA|x Ë¬ÇúGÊ/Ó§±e%Ã=}ØÀb+;<±²V£»m;N,¦}÷Ó½)÷ÓÀ:yçí§°ÓÄÎø/ÓD9j÷XQ8§{¯ÑÇ­´0ÿvÙ&¶÷{Z?N~×Egÿ]GØ±Ø»o®_üÖÇ-à*CãÝð }T¿éB¦aLþü(ÇaD§çñhôÍ@úÚäß!/#è9ó¢&µ0\#Xt!A$è£$	üP4OfCûü!¦èF$Òr|ûq¼ìjA9ôj"ê9Q3¨ØpH&hFnRìÛBØYæA$¶¤Bñ§z¾Q¤j#ðû¯mÑ¶+@ªäF,@C*×WBJ~$ÇÈÎ_* y×gsyÆx"²ôläh4ÒÕ\
âì÷qp®tÖT¾¼-'x¡­~ìúÕ±þz©¥yªªBÈ¡ZDT:k%R<scÎuüzcRw<m¾Ö«CÒkÂ²Ò±½w¯W»â>-	Àcðº"ö²ñ2¤i%Éô\PÎÏjp3¢Àè½*~7j|<ù²ýEH£|}ÅÌ CRåcäuhµ5ÍZÞñ5\ÎB1S&7Æ[Ã«K8Rf3!(9nÕ£ËÙ2§ÂrZ\®·SæFN<qÁm_I¤ixë-åBMÿÕ;(üµ¢~Ï=Mä4RÖ*=MÁM8OJÃI§1°¡fn_ìz3Xþlesº²´Ò×ÔÝJ»X.M»M|M»½¸}Ñ¼ì¶Õ¢ßãY¡ß·\¢<×óC¦^&ÊÓG¦4_¦Ìª÷.'_A¸7RÂËûA¿Ùmg¿	­Ü®|Â¼ÔöWzäs.(P"6â5_éjº¸.òmÛrÔù(Ò#ri2¼%dôò¾2¬Nv¢Wu×Ï(+/z´I¦«PÛì;¥ExÌ#;ì¥EÙW;v4=}9³D	û'×!F*¨«;n§­RøÞ!¾½ÿØ¡«lÿ$,Ú©ÂÙÝsîMß)µÚ?XÔk>s?ÇÞB½l¿~ÚmØ¿LéÝ-CÏO¼Ý!ÂÅÿ®»ÜA]ÉÿØ+¿ß
Ö£ÅIó¨ÂNÒèÊÅY"ám»ê¤Ë	#asõ({GbôQÏ6$Tòtx@dBò%t¬þEêótqû¢vÝ
4]7¡¼;e'cÝZ5&6 ,u â5ÇQ!m*JÜl5ÃÏèUÖCÓ5}0/U*zµù.ã'ú³  cÚzÌ©OE-jÃ¹*ë«]:,õ·Âgoö¢Í:(M´F¬Mç_¶6$gÇ·Tx#4jîÂóT¹U4wR¤çËB°«ç³Cþ«ËÔx2	×æ½89YÚyM Öëæ|6ÀEáúíé@(ËãìY±Mhñ¢OlÇHd=}mñC7øÓÒ&¦|¨Lé[zðB¢y$ój¦zÒÁ	³D-ÑèÅ&	ÃWzñÒ¡lONFÌJC¸Srþ{CBI®w2Sh:Ëå«U=MxyI¡ÉvlK©%+¦9OõËî:Q0ºj!6ÜÌ¢ÙKê8­½zs­¶¨ÕíÓMLX6A#Èò;$N»NH+Y=MGÆ¸ñR©îU¼3Ì¸©þßóÖüÙC/Vt&^ãîrî<èT ¯APgï¸£qrö'ÑÖeóÛÍ}x=}Ã$«êG2ÎÃAÆl1êë=}pÎ¢÷DïÆ9(<TÅzÚ	,RÞû_½xôËf¸HWþüR''¶}Ä0W¦ïÑÀÄNï4[pÇÇ¡zþï¤¥©ØÀ©öï/´;É¹Ä¥7>ZQ¾k ¾Ì\Âm[
i9Æ£Å[´xÚ 9Ì£1?ÜNØR£ wqY­ÕÃÎ5FKÛqrÁgÂì_.?ÐGfzå	Þ¸/î ÜTà÷ôã8ð ØÑaüëÝW a±a¸oê¢Ð0ðÊR!fçø¥]¡)åCðül0è^bðrg0Íÿ¢hðvÝ?'dÒªôÝ0ÂVd±ßl=M~AOï£VKO£¹Èö®vP¢%ÕUä×}ÐKl@Úf(>h¥rMÕqÈmBÄ¾¹%1>ó¥µµ±nÆ-5±ü;ù#²£ø;¥0<ñ£«Åèh%½vÅ$mÃÎfy§A5ú§©ÑT¾i§¬~SÑì?|= ¯Íä>{aJ±$LOÒ¼q=M%iÔ=M,ÊFòú&),BÇ¢D¿,ºyhbD¬$2pq¢#£ô.ö=}õ±û,,E uåIt?/¯ mlÜ2÷s\}ôcT²Ó³©9ÐoÂËßØ'GÞ&jDË&æìðôDP)swÙCxiU!194¿¨Bb1ö{ëû¹{¹ùEs?x­X±üäRXM|cE1îÙ¬}«9s<ôjSi;t§Y|­#ol¥Ù¬{¯]\|*ÓÉ=}2 q[åHy÷096 _«ê1?(i%BõeÚ!ñçjB@%·ÿõó@=}¬¢ÊB7u0ÑdÃ¶tW-	/+ÅJ=}	qK«¸Òì3gt|n÷ÅV
|SûhY5¡þwê{¸òuS¤òq5ÈBn'õºÍ5¬¾>mÖgJÆX5·9mh8íJ8Æ3c-WíËW¶ÂÞv}^dÔ¶RD7ý©¿Êò0'Q_ý/äÕi·þ4¯øÁæ´×0á»pæïML?Eú©ëKÄÑÐî·¤t¨l&ÖP{ú½,ÆÈöÎÿMÕWë²=M,þ·jÁÑ6¶©Â÷¿ª±éMD~LÃBûiM(.JGÂyVÔt»9y²n§tîÖ}Ë 1cKIý4,ËÄ­e.ÚµÙÙs°´¥ü¸{½ü¶É{kS[¨¶£=MþªS[XwÚßÏÅu!=MÙóÉÍ&ÿÏmæSAÿO%ÛIµ¯Ss^JjÛX= ¢ã<û TàÓ	"b-"bÇæY¨Odä*"bH7¡p¡_"b·³då¶;dåeÇeå¾éënëë½eåÎÉ¢bß(îZèð_»5KÏ]M»´M»M»û/®d%w$yü)Ôr¤Ú)¼|dJ+òÙ±Î+òÔ©|¨y¬w©3FJ½ÏJ§Ó¾pbWê4/Q×ôf-+Aµô®>+Á£ô4Å)2m4Ö(E¼Ô46M/ÅØÕ4þ]/Åo	í#¾ò³¶m²Èm²xÑmµÆTÖÄ-ÇL­TÎÔ,ÇµlTÏ(ÝFÉ8âùâäDÍ ×,áß¿	 ¿-áå_êDñ2#(a:"ÒÕòr3(®}"¿ôòÜ	¤Iñ¯ðÂ//ñÏGhX#¤eûÖÝðÝ³÷x¡¥É	ªìù¤Oh)ÝÆi)¢±òv¶pgdæ³Ü=}bÞd¿ü*yy;*Ê2êTw~Å¡6	K*ÉÝ5*cìEù7ªx³5&£	\;DC©GùmUR<Ä¼GRGE©)¹GË%=MªKôü¯;%å~nê.o7°Eâ«YåÛ¾	H4rv9©R*ê3RGlrÎKt¯9Ò:)f,¥Éj5NÇ(õÉ5l"ß"¥qú'(­ÜÂJ<­µ¬ù¦4­J/´ì,³Ð¥9Aí7ûI(£Úåú¬çìÁ9=M|:6Ç³%?=MgFKÏ¶²ÙvvÃ8=M:Çµfî!ïýõÉx5§}<?T²Éy=}¯}*Z,}Ô4xGÈZ®ÉYÕ6o%AX¼ §æFOagì}ÀYN °(­= qn%mìMBD¦@öú¹V ¨Û&.GQ©AÂúN´Qi-|¿AÚ×3ó[y8Oy5¬ÔÌL±$xi}_GÆu¼¢xeÙ=MTOEÔèëÖÅö>ýÍiÅ?/6*X¨ê9³ ªÈÞßÐ<©[LE­/Vm3MTF£µµ¦±):N@CÙûeõVN¥ÌTMu}i£Íw¹9Q¤.v§V¨ÅVcÕüÏÃ «¡dýîrH×µ¡U}sÜ¹}Ècs&C}Ì9Í$_ª)÷.Vë=}(ã÷Qqkã<dÇH§¥r;ÎÝPA	y«-¯
NvVRSA{OK½8¯ÙÏu{zBï=}bþ&õÕgUãÌyÇÁ¸þïGOYØ££wÓ|ÌÅ ';¦Y9¦«¤3>ÚÐ²8Èx¿'otfNÕÓAo]4Î£Ùµ§µ9ÝÏ¶¶¯q^Æ×3Ét§^¶çÉìpiàëKå¸ }	áMêÜË Ìá¢ {£!jç¹»ècbÌx÷»~ «Næ]ï4ÿÂ]ðµd¸¹dE4h«#|ò¢Ó$ÇÛÍAßï3&xi=}£<xø&,ÁAì4øÁ¢¯bñ|ÕôÈóÎlè½&ø]	¢|×ñ6©Lm$¹=}ª1Öìl]NtUþEÂwÝzFn1,lP«øÉ#C¼=}øCÃøcN§ßf©ðÇVSª§µnV$|Ã+ÂÔøP®?QxòÈS¸8!ÉVéÎo,°Q9bßý.Ì^â¹äß2Pîè@ã0ì}M»VÍBM»M»M»M;ÿ±r:  ·â­&é<>Àþöx_? ²ÿa%K
j4OX¨åîiÜw¨tòi5i$«¶òÃg+L<QN¤Ó»òñ^((s6r©:&Gk_Ä> sFo,Üû«-P¢ºÂêúÎ@­6h=}ÁªeÏôÊ§5©x3ÅF!uÑU5êÖ4Y%EÚæõ®¼Y²z&,úküíz¦ÎnúÁ8mcÜú»ÎKÄÝ.T%59}=MTÒì±ù?Çº}ü·T\´¹þ¿ÀGã!ÛZæk[ú<~BðQc!n³æ¥ùiB²©$³D!ß=}û'xL>LA©j{Sxl.D±%Íö(½»Â£4k#û~Õ¬3ô{ÛÉLFùõº$MC^x-meWß«¹HÿM.¦Su³ÁIÈ°£î9Å0Ã£Ûî²g©=}éõ+HÌÒ+ùÃ<ÃrØ+©°ýµÁ&Yh°êîáGþ4¼ám!g°'¬þüo®5zÓ¢Ào<[B=}ÓXÔ¾CGü1¹\[ùÛÌÀOt/Q×ÙÌÎ³Ð/lXá+çØ^ ÅÊámæûõ°E) ·áýçßð0N¨qLÙpQµ">ï	DÊp§#Ò=}íI×Ü«ð= »ñåM»VÛM»MË¶M»­ý/roA=}iÇ¹4t)TISd¤Öeò÷W*ÑÕ$t8ç=}&jÓ¬³!÷F«L½Ýl,ºyIô~ô18Ip¢½©êÃ#êÅoØ"Æ¤
;SA
wJ´ÊR[*m%
ÇVd=}2é2)þ#+æmëR»ú{JüÉñ_zf6CÄ1m]W¾_µ¨p8.CTÚ7·yº>G¹P}íÓUMëÚ|®¦GÞÉa¯æcëû0íÚæ¹û\ûGPLy¡¤æ5úXKP©l%+z¼,Ú©°§D«DóM©ucUOz¼ßðÌö78EöÉz;ÔÉGQ]%öÝï;|EqÄse÷¯FT6{ÝEL¾V´¯Î4{N{qgL¿9Ð¡FQügåyýwRøITKÂ0#)îI7»Çß£îNìw¤É=}.ôUÉÄÏR+×	÷dVP¾Å´3÷Ñ§Å2Rï§qorµÆÕh¤ÑoËrüÓW§CÙo÷Q]REÑ;ªGÅq¯cþ1§ÛD8Ê3Dw/¸åÿÝyoÝ§§,h¬i ;5!¼¶bwãä'éFgäïæ¼U¡¯ÂcÂà $à$±L»ÍZ¹>{¹M»M»M{ÜB'4aîå÷ô85gp âÕFé¼=}°Ü {;âèmó68 íqé¨{î5fi,~=MROc(¶C¡Mq¹ÿ$®¥pØs6[Aiúµâ#'[iq#¬tx.BÚAiifuÈø5&/3,ªOEyDf×w%Î*y£[E>r©Ú<Æ´Oy¶iõBÆ0x=}&?ãea"yÎê»&ô<Pk"bsê}Ï
<Ùø¥4ù|6Å2!uT55ü5EVËè¾?ºôub4
}l]ÐgªØú»KÌv¦
+C6çm#:®°&Óám/wÖ·øÖ;&}¹Tu´I:'.c/GÈT;óÕ= ®Ð«ËìØÓaa¥À$Qcìfyæ»ùÄûD°U¡®õæ¿WûôOÀøÓµ@3Ls«É,¾öi2¥qLre)z¾	§y¤?HÒG©ÓCOzZCre|´+îk÷6´èMk4ýníHµ©êkUV¿¢ÛDÑ-s4WÓ¸
Oa-¿F(G{Û#Mj¯ùªÆ¬þ{$ÇMÊlÀM¤PªZ>gLÅýªPHÈ8}üzìQH­¡;Á ÏRV¦ gÿü¾%Qz¬E:î÷t+º¯ìwÙM<¤^q?È2K«s¤YÁÉ+jXþs³[¤=MÈ±§Ó&þÕâo}BìÕ°Y;ÎÑNg'3þO[\ÃQÁ§dùÛtÂ6ÑIÚTHÂ³K¤îÓI½<Á³X/y3ÉNÛ\[ÍSÆo¯|äá­æÄ=MôÐB b&ábÿÐC r!áµç¼?ü°Y+ táæ¤_öÂ;$F(Û4Se4ý6¨7=MF«p	#Nmì)$9õZ7¨®3oNe¤XýrÕW(yX-séRøÅNó$©_f«áºN èM»»;»C;ÃM»M»­¾¡¡XE*tÌqA¤¿9ò6)½*ì1Ûv$b7ò_*$¦s	q.Æ^>yEERµq°:e
Ówl,ÆÍ4ùC¬£=M­n¨ÌsÝ,Äy;±ôê3È5Á0ñexuõ
2È¹1AP¢Ç1ê©F	Ä;0Qg"}ÃêmeÖ3eZ?"Ô4ê7)s-Å7ñuûOò¹!rªÅñ
C4=}Ò^kªl£
õeHÿÏ5Þ3ù}0IæméÙÂwµèÑe&kÎú»\môñúÚm=}SB¶3C´Qm£7¶¨Õ)A4ý®xlkÒËLv®Áö½-Go,G¾ø}ATÔõÉDÓÖ®®ÛAOUØÓ¡z´æÍRú¤N!Õfæºù8z¡o~æAcíÞ-È¯ÀÍJcníný¨W¥@Ø#cÛÏìjßèoGR)||µjyÔ¡D%]s+M,«e)qèsÊC-z®I¼Ýösç-úR»ÀësÄ?-%{¸B1æë%e2ö19¿Èµ¾FQg%8%¶Qö[F9?NÑDeW Â»yð½-ko/=Mt/ö7ß94.@m-Ô|ÍjºHÓn-mv£ºüM^×	¬Í{ÐYë6¹Ì¹FSÉp­SOO¹\ZöºL¾ÜYø¿Á"Jg}¹ýÆöVø0¾%=Mg­üUT¸$ÖT ÔÿÃBf#«î_¶¬»Í0Þ£¥+î½Î[É°Ã£·^"wGI<:ÇP4¸/Ywñ=}þQ	³¡EÊRP)ýÆ²J«d	'Æ\>ÅrI{+µc=}®ÔÎÎq«|«^jÁ§¢Tþ3SZìÂAu×H2³PóoÍN©þï'AþXyÍ±Yy÷Ê»ÍÖHW¬Ã§åoiRÓ¸Ô¡¢OoÝ\
Õ¹v¾_y%\w×1JØüIÄs/°½ÇÍóo/!Ã¦ØüÆÓGa/aµÚÔ»ÏË¯¶«ÎÚ¼ZÎÓÔ¯¿Cå+òP=} ¹üáëå¬óð9CÝ= r=MãBWîå¬ê"ááÉgå<úÿTF i¥¾áÁ»âÿè¸^¡Å= »WâÄGá¾çøã~&÷/}*0k@>>!tÂbîõä{KèBòO=Mx½%P/÷Dôb6ãäfêVnó~h0pWuÚF!âÓ×!¸U!¤c°Ý2°Ës ß=MHÓ¡R= â
fâHM»V½L»»M»M»ß¡ØÌbr±äÉÂë¢ð¨ ¸z3p6	!ªb»åzèJõdÉ¸ämÛë"nð¬ 3PAÅ
¡-â;ÐÃPéÎ7äÎêõô]8Ø-ðd9ä©¶ørèéU3ª /©|r4em+*6tü	Y·0òu@àwsìþy*WrD©©²%r%)¦ÎrÔIW*2ÙrË=M)¤'rÛû*Úßt4ìhö)QB$"%ÑtjoùôÓSª÷0!|]¥¾jJ-õ»ºT1ÈÈÀõoç	ún2|~3Pa¼jàFBß%Ü]á¼1¥¶j_wõOæ2Ì[ØÚ!qÑg>è­= Ðz±'ÃJþ±Ü,iv9sw]!-¶Âx9J²´±Li¸*ÓcÆ6W­>y½7gH
o¶}Y#I&=M³Ä?Ù9BwÑ!-Äóz=MÇmJ^¿¶¬\©Ý2SÌÞ­Ãz®AìÏù¥lOHq¬P	mDF£Ê|f8åìkùtDDÈ7£P~I3#{¶fuýãÎfTª°oA¢ £añf·ÃìúÒ­´9HÈ¼TA¦F£}fmÛí»oúV~îÖk¡ÝAÙ=}£¬§fAí¾ûÊ]ôØMh÷ªÒÅ(4«´¸v¶é=M9s;L®DÉq£rÅ^A«¤òöª9>4lI©1¿Ri=}«ÖvQ=}Mp'vE±¯NPoÿG)¥AÅ¿+§vë=MY¶;MéØÏt½OyY¤ÒÒ¿Y+¿vc=MÏ;jxwvÏ×;ÞÄßGIò¦±C.§Ö¸nSéüorRÜ-Ïèwµñ	wR^'dnpü¿ª>4T<Æ0»aC43'6nRÍý©ÕPüvni®±Åð§Ãñn%Cý-Â-W||ÍëüÉw®T¨Unä{ý»JÎéXüPÔÊhVªË|­E§ªËnWüÿäX/ýÓ>BSìÞÄØØ­±ØÃ0è/~ñïZê¥Òlo÷|óYR×´~#ÉÁXªÇÐì­Ã¹? Óh3é/£~AõËX¶ÐÜÃ)°°s*+/«~¾ýcZ¦ÖÔ,u~9¶OïìÎ#c×q~aCãiáÜ´àOF= ¤SMeGÃú¯hí~;¹WXÞÌÖü»ÏùW¸3Ë®I¯S~wEY^¾ÔÜG= |âÈàB 8»M}ºM{)M»M»M»M®©ÎËÞþæèÙ z÷áéÐÙ]= )ãDÚÎÚ?áúÜëÐx@dÐÁd©ñeØ1ed$Qd9Ñexie±©d dIeÛùdR9d-¹eeÙdûåe<%dQ¥edÅdñõ¥yè)KèKëKÊéÏúêyzêM;èk:}ðs0¿ÕðÔöÖÔóþðBpBh0X0Wt°YDbUXz^CnOPPqo¢Þõ¢µÎM}\Û¿lºÔ¾»t D$\|=MÔ´\	ülÏWodX/e»¯e¹dOeÈÿd3<Ó5¨Þ#XÔ+øß7¨ÿ4Yô<ùñ*©ð6ý>Iû)éõ5yû=}©ù+þ'û?Y~0É~$Ù{,ùr2éw&ù}.ip±Õyuð¹t îÅC%>ÅJ^XE]A>E éÅI	T9EYYDQõE'R-9ME+=}³ ²(yµ¤3²4º6¶5>7²T2zV1FV3®×0b×6×Õ= 6uÍÝuÛãÞðß,	"I*ù&y.¹¡S.Ò3tï³t uhuSuÓu4ëuTk}§2ÿ«ß*ÅJ±:ÆZ¯1Ù)Y%-#¹«ÝÎÑlÛÛá´Õñ×P¬Ûü7V~4|6:}5Ò}WF÷u;w|£õ»Àí¯]«K½VWuê×Ý¯#ÅÄGÝ$	Ô,ÙÒ<9Ù2IØºY5ÖSÿt¸tãÃ7²WEÃïÚÅ³OÏÙ7©ô¤þ´Hü¼Øö¢øõª(ô¦8÷¶ô¾õ¡ù©÷¹HõµXó­Èü£Øø³Èö»Øð§Èø¯Xñ¿Hz°q¨x¤x´¨q¼8|¢hvª´¦«&T¦®Ô&rl¦,¦³¬&©¦rL&ü&c|¦¶<&&Ó¦n\&dâ^?°8=}¨ØißB,Êjù)+ø=M+ú+ù+ûù«úÍ«ùªû/
øiùûÃøgú¿ùÉJøÕJúKù»KûoËXZ&ÎÚ&£æ¦ÀfOÄ¹û[¾¾yKzû:X¦v&umQ}ÇHÏÜøù&f&®N&¡Î&Ñþ&y~&e>&¾&ÅÚ^&= GòúY­¨²¿( h°]íbì¾Û¤´yìS£ml~}­¸H­øÜ8×ÌÃ¬C­XC´äµ$_D|L\ÕQFjËú]É®HfÑ¡§ay¦Ø9>OÇ}C\ÑO\~[~O¤:@¼ÒOS8D8ÌÌÞLïaUáàæ·M»M»M»M»½¦|£¯ÿë÷[¤ÏÕswÙÜRvXï}7Ú5]Ó¾F| ú×gåKÍ¡m«·Ki¦q½ÈÛ{¬u9{Í«öÃ$S|L{Û*³ÍÖZg©³T¾E¨+¨§°\¿G¼=MYóeT©÷I-^+/]ÒÚÄÑ¤Â)Y4*ÒNÒÿW_R"Ë*±sÞ38\p\¡D±enYá®ù{OÔ¬Y+cëº3j<´r4¿e®ý#é}ÓFÂ=}µRÓaÊzÇ]YÅu¯»hY³ÄU°éÚMCÐÇýÍ(kÎ£5²JgP{l×m¥M²ËçSuÄ:Éþ|Få»Ù6=}iÙ{^Z Ù7'=}oEk~çÙ.3=}jQ<Â?MUUFPs8úË:¬ÄæßIqÜªàVñ(:ÍUÆQm?¸eÉ©Z~ðÓ}[¥àÐløÌ2ÔFíWØ%}{6¬ÀøáØÈÛÔDéÇé©×xÎÀÿiÁ S¦y{\öåù¯ò*MWþÊ²oYÌÇÉÃrgºÔDú;¨^²]ðUÉ¡D¶Rbg$Ðoö=M%'¦d<ÂË¢ßõå*ÚiEÌÂüïéÄX,2swÒcx¬BPd«Æó?J¨ß I©#	³t.ì@9¦FÖSzËÂýA\ß}8	,9³= 6Tï#ù§Æ|ÕLG§§ÎÒd·\lT½¿Ñë_ósØù¨&Nê2l²4
'Cz³fîTç]ø ð&fÑ,Fúy«âöluAýû¹¢V{]üÀð'.TQ×à½¶úçàÜýru)ÇJ*ÆÒÚÛ{ÍL»9ìÅ»+»RFû¡Û¿Yï¿ß|¿nGcÀøá.b³Àï= +ÀÚ5ZàûéNa»ÀîëÎaÛÀáXØ5û[Û'îpã~\ÔôÛÈÙ'ZÙ±Þª{Ý®?Xßw
Üßçq÷ÄãÙaâ!áÀì<= PãÎ ã§ÃÅ®kõ²Kh²póò%&ÃòåÈ²¥ÉnÉuÇT}m!T#$Èa3¢È²kz³l=}ÉFÝf°±ëÈ®	oiÎE|'çATòºÄw,;[E²Ë£¯²Ì gnnwI¯u,'JFØøOMevÁ¦ä÷}è³NøcGVÈª±ìAB'%s=M¬¸ë&F2·Y,Ã_6}z»)¬Eß,ÆHµ,5_³"~£,ÍCûü3/×¹9Õ¹»£LhýZøÍ5AL2­¹=}¹=}7ç{$¾iÌÀí&VomHbE
OF³¶|ì6ÆTvÍX¯¢Ú¸5D¼õ*®+­EÚYSüÑìÂ\CN ¹0Niù×ë÷SRäwBlÁf&ù{jY<*õ|ÞÅN´Î½ì._ÀìG<EÁ>ìQPI¥EIr_¹/­ÇSXÑ}ëJÙÆ·âÙÓÍO|ûªvÃ#TÁÛü¬ªÿ¡×Éý£'Òõ­ÅuOvÓïNÂ1ÜØì^±ÜeNöÞVç_Çé´Jô¼e&çdÍömAM$kecý#e½{é1èucåy<3=M&x?¹l97Èr<xM¸é½Gè®Ú"PIkÐ F÷\n1B>_ø84=M~ÁöºñWnèô§"BáMx>yX3¶%üOphr¢¥¥B¤#RXI¢<[®RÑ\-Â3iÂ6%føNöÓkM73ÈX>Jß e¼[YiqúÔZ Êë.×Ô¾}=}JGO¬ A&ºCo&¯ùpÑ<4×R4¢D~wh´'³1q³¤âB:º±jê ÖPÒ¢¦ú¼´ðWj Csþ»¶¥§V¦É!Ø¸ PúkËí¬<\08n»hM½òQ	ýÏnmÃ1
^½n»õÄº,õqYqdrúÛRàÉ7ûq
£Õ¤°	yVþîõÊdsék)Tad#:
wó§mÄe_QJu.Úµ-ºösó9o)û~r&p^
É¿Ë¥Örä{ÂiwÊÙu÷}iç*3Á²p1±re!|'ZY^y´OÊ&©Ë¥þIOôÂ^:
RÎf$Ïû¼-53É
N=Mzæõ­fåÈ<öU½DZ}¯Ã·» Ã ß>þx2ôµü4áÿ"í!!0hÚFz¼YA8ÒÝ0ôôã¥_¿ëXãÿ°öÎåöáo©ô5I5µ=}ÎØ¢®ïÜ^ÁËÝ¿z#ÎÌÓÝQ´7S§,3õc÷`});

  var imports = {
    "a": wasmImports
  };

  // No ATMODULES hooks
  // Begin runtime exports
  // End runtime exports
  // Begin JS library exports
  // End JS library exports

  this.setModule = (data) => {
    WASMAudioDecoderCommon.setModule(EmscriptenWASM, data);
  };

  this.getModule = () =>
    WASMAudioDecoderCommon.getModule(EmscriptenWASM);

  this.instantiate = () => {
    this.getModule().then((wasm) => WebAssembly.instantiate(wasm, imports)).then(instance => {
      const wasmExports = instance.exports;
    assignWasmExports(wasmExports);
    wasmMemory = wasmExports["l"];
    updateMemoryViews();
    // No ATPRERUNS hooks
    initRuntime(wasmExports);
    ready();
  });

  // end include: postamble_minimal.js
  // include: src/ogg-vorbis/src/emscripten-post.js
  this.ready = new Promise(resolve => {
    ready = resolve;
  }).then(() => {
    this.HEAP = wasmMemory.buffer;
    this.malloc = _malloc;
    this.free = _free;
    this.create_decoder = _create_decoder;
    this.send_setup = _send_setup;
    this.init_dsp = _init_dsp;
    this.decode_packets = _decode_packets;
    this.destroy_decoder = _destroy_decoder;
  });
  return this;
  };}

  function Decoder() {
    // injects dependencies when running as a web worker
    // async
    this._init = () => {
      return new this._WASMAudioDecoderCommon()
        .instantiate(this._EmscriptenWASM, this._module)
        .then((common) => {
          this._common = common;

          this._input = this._common.allocateTypedArray(
            this._inputSize,
            Uint8Array,
          );

          this._firstPage = true;
          this._inputLen = this._common.allocateTypedArray(1, Uint32Array);

          this._outputBufferPtr = this._common.allocateTypedArray(1, Uint32Array);
          this._channels = this._common.allocateTypedArray(1, Uint32Array);
          this._sampleRate = this._common.allocateTypedArray(1, Uint32Array);
          this._samplesDecoded = this._common.allocateTypedArray(1, Uint32Array);

          const maxErrors = 128 * 2;
          this._errors = this._common.allocateTypedArray(maxErrors, Uint32Array);
          this._errorsLength = this._common.allocateTypedArray(1, Int32Array);

          this._frameNumber = 0;
          this._inputBytes = 0;
          this._outputSamples = 0;

          this._decoder = this._common.wasm.create_decoder(
            this._input.ptr,
            this._inputLen.ptr,
            this._outputBufferPtr.ptr,
            this._channels.ptr,
            this._sampleRate.ptr,
            this._samplesDecoded.ptr,
            this._errors.ptr,
            this._errorsLength.ptr,
            maxErrors,
          );
        });
    };

    Object.defineProperty(this, "ready", {
      enumerable: true,
      get: () => this._ready,
    });

    // async
    this.reset = () => {
      this.free();
      return this._init();
    };

    this.free = () => {
      this._common.wasm.destroy_decoder(this._decoder);
      this._common.free();
    };

    this.sendSetupHeader = (data) => {
      this._input.buf.set(data);
      this._inputLen.buf[0] = data.length;

      this._common.wasm.send_setup(this._decoder, this._firstPage);
      this._firstPage = false;
    };

    this.initDsp = () => {
      this._common.wasm.init_dsp(this._decoder);
    };

    this.decodePackets = (packets) => {
      let outputBuffers = [],
        outputSamples = 0,
        errors = [];

      for (let packetIdx = 0; packetIdx < packets.length; packetIdx++) {
        const packet = packets[packetIdx];
        this._input.buf.set(packet);
        this._inputLen.buf[0] = packet.length;

        this._common.wasm.decode_packets(this._decoder);

        const samplesDecoded = this._samplesDecoded.buf[0];
        const channels = [];

        const outputBufferChannels = new Uint32Array(
          this._common.wasm.HEAP,
          this._outputBufferPtr.buf[0],
          this._channels.buf[0],
        );
        for (let channel = 0; channel < this._channels.buf[0]; channel++) {
          const output = new Float32Array(samplesDecoded);

          if (samplesDecoded) {
            output.set(
              new Float32Array(
                this._common.wasm.HEAP,
                outputBufferChannels[channel],
                samplesDecoded,
              ),
            );
          }

          channels.push(output);
        }

        outputBuffers.push(channels);
        outputSamples += samplesDecoded;

        this._frameNumber++;
        this._inputBytes += packet.length;
        this._outputSamples += samplesDecoded;

        // handle any errors that may have occurred
        for (let i = 0; i < this._errorsLength.buf; i += 2)
          errors.push({
            message:
              this._common.codeToString(this._errors.buf[i]) +
              " " +
              this._common.codeToString(this._errors.buf[i + 1]),
            frameLength: packet.length,
            frameNumber: this._frameNumber,
            inputBytes: this._inputBytes,
            outputSamples: this._outputSamples,
          });

        // clear the error buffer
        this._errorsLength.buf[0] = 0;
      }

      return this._WASMAudioDecoderCommon.getDecodedAudioMultiChannel(
        errors,
        outputBuffers,
        this._channels.buf[0],
        outputSamples,
        this._sampleRate.buf[0],
        16,
      );
    };

    // injects dependencies when running as a web worker
    this._isWebWorker = Decoder.isWebWorker;
    this._WASMAudioDecoderCommon =
      Decoder.WASMAudioDecoderCommon || WASMAudioDecoderCommon;
    this._EmscriptenWASM = Decoder.EmscriptenWASM || EmscriptenWASM;
    this._module = Decoder.module;

    this._inputSize = 128 * 1024;

    this._ready = this._init();

    return this;
  }

  const setDecoderClass = Symbol();

  class OggVorbisDecoder {
    constructor() {
      this._onCodec = (codec) => {
        if (codec !== "vorbis")
          throw new Error(
            "@wasm-audio-decoders/ogg-vorbis does not support this codec " +
              codec,
          );
      };

      // instantiate to create static properties
      new WASMAudioDecoderCommon();

      this._init();
      this[setDecoderClass](Decoder);
    }

    _init() {
      this._vorbisSetupInProgress = true;
      this._totalSamplesDecoded = 0;
      this._codecParser = new CodecParser("audio/ogg", {
        onCodec: this._onCodec,
        enableFrameCRC32: false,
      });
    }

    [setDecoderClass](decoderClass) {
      if (this._decoder) {
        const oldDecoder = this._decoder;
        oldDecoder.ready.then(() => oldDecoder.free());
      }

      this._decoder = new decoderClass();
      this._ready = this._decoder.ready;
    }

    get ready() {
      return this._ready;
    }

    async reset() {
      this._init();
      return this._decoder.reset();
    }

    free() {
      this._decoder.free();
    }

    async decodeOggPages(oggPages) {
      const packets = [];

      for (let i = 0; i < oggPages.length; i++) {
        const oggPage = oggPages[i];

        if (this._vorbisSetupInProgress) {
          if (oggPage[data][0] === 1) {
            this._decoder.sendSetupHeader(oggPage[data]);
          }

          if (oggPage[codecFrames].length) {
            const headerData = oggPage[codecFrames][0][header];

            this._decoder.sendSetupHeader(headerData[vorbisComments]);
            this._decoder.sendSetupHeader(headerData[vorbisSetup]);
            this._decoder.initDsp();

            this._vorbisSetupInProgress = false;
          }
        }

        packets.push(...oggPage[codecFrames].map((f) => f[data]));
      }

      const decoded = await this._decoder.decodePackets(packets);

      this._totalSamplesDecoded += decoded.samplesDecoded;

      // in cases where BigInt isn't supported, don't do any absoluteGranulePosition logic (i.e. old iOS versions)
      const oggPage = oggPages[oggPages.length - 1];
      if (oggPage && oggPage[isLastPage]) {
        // trim any extra samples that are decoded beyond the absoluteGranulePosition, relative to where we started in the stream
        const samplesToTrim = this._totalSamplesDecoded - oggPage[totalSamples];

        if (samplesToTrim > 0) {
          for (let i = 0; i < decoded.channelData.length; i++)
            decoded.channelData[i] = decoded.channelData[i].subarray(
              0,
              decoded.samplesDecoded - samplesToTrim,
            );

          decoded.samplesDecoded -= samplesToTrim;
          this._totalSamplesDecoded -= samplesToTrim;
        }
      }

      return decoded;
    }

    async decode(vorbisData) {
      return this.decodeOggPages([...this._codecParser.parseChunk(vorbisData)]);
    }

    async flush() {
      const decoded = await this.decodeOggPages([...this._codecParser.flush()]);

      await this.reset();
      return decoded;
    }

    async decodeFile(vorbisData) {
      const decoded = await this.decodeOggPages([
        ...this._codecParser.parseAll(vorbisData),
      ]);

      await this.reset();
      return decoded;
    }
  }

  class DecoderWorker extends WASMAudioDecoderWorker {
    constructor(options) {
      super(options, "ogg-vorbis-decoder", Decoder, EmscriptenWASM);
    }

    async sendSetupHeader(data) {
      return this.postToDecoder("sendSetupHeader", data);
    }

    async initDsp() {
      return this.postToDecoder("initDsp");
    }

    async decodePackets(packets) {
      return this.postToDecoder("decodePackets", packets);
    }
  }

  class OggVorbisDecoderWebWorker extends OggVorbisDecoder {
    constructor() {
      super();

      super[setDecoderClass](DecoderWorker);
    }

    async free() {
      super.free();
    }

    terminate() {
      this._decoder.terminate();
    }
  }

  assignNames(OggVorbisDecoder, "OggVorbisDecoder");
  assignNames(OggVorbisDecoderWebWorker, "OggVorbisDecoderWebWorker");

  var png = {};

  var inherits;
  if (typeof Object.create === 'function'){
    inherits = function inherits(ctor, superCtor) {
      // implementation from standard node.js 'util' module
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    };
  } else {
    inherits = function inherits(ctor, superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function () {};
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    };
  }

  var getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors ||
    function getOwnPropertyDescriptors(obj) {
      var keys = Object.keys(obj);
      var descriptors = {};
      for (var i = 0; i < keys.length; i++) {
        descriptors[keys[i]] = Object.getOwnPropertyDescriptor(obj, keys[i]);
      }
      return descriptors;
    };

  var formatRegExp = /%[sdj%]/g;
  function format(f) {
    if (!isString(f)) {
      var objects = [];
      for (var i = 0; i < arguments.length; i++) {
        objects.push(inspect$1(arguments[i]));
      }
      return objects.join(' ');
    }

    var i = 1;
    var args = arguments;
    var len = args.length;
    var str = String(f).replace(formatRegExp, function(x) {
      if (x === '%%') return '%';
      if (i >= len) return x;
      switch (x) {
        case '%s': return String(args[i++]);
        case '%d': return Number(args[i++]);
        case '%j':
          try {
            return JSON.stringify(args[i++]);
          } catch (_) {
            return '[Circular]';
          }
        default:
          return x;
      }
    });
    for (var x = args[i]; i < len; x = args[++i]) {
      if (isNull(x) || !isObject(x)) {
        str += ' ' + x;
      } else {
        str += ' ' + inspect$1(x);
      }
    }
    return str;
  }

  // Mark that a method should not be used.
  // Returns a modified function which warns once by default.
  // If --no-deprecation is set, then it is a no-op.
  function deprecate(fn, msg) {
    // Allow for deprecating things in the process of starting up.
    if (isUndefined(global$1.process)) {
      return function() {
        return deprecate(fn, msg).apply(this, arguments);
      };
    }

    if (browser$1$1.noDeprecation === true) {
      return fn;
    }

    var warned = false;
    function deprecated() {
      if (!warned) {
        if (browser$1$1.throwDeprecation) {
          throw new Error(msg);
        } else if (browser$1$1.traceDeprecation) {
          console.trace(msg);
        } else {
          console.error(msg);
        }
        warned = true;
      }
      return fn.apply(this, arguments);
    }

    return deprecated;
  }

  var debugs = {};
  var debugEnviron;
  function debuglog(set) {
    if (isUndefined(debugEnviron))
      debugEnviron = browser$1$1.env.NODE_DEBUG || '';
    set = set.toUpperCase();
    if (!debugs[set]) {
      if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
        var pid = 0;
        debugs[set] = function() {
          var msg = format.apply(null, arguments);
          console.error('%s %d: %s', set, pid, msg);
        };
      } else {
        debugs[set] = function() {};
      }
    }
    return debugs[set];
  }

  /**
   * Echos the value of a value. Trys to print the value out
   * in the best way possible given the different types.
   *
   * @param {Object} obj The object to print out.
   * @param {Object} opts Optional options object that alters the output.
   */
  /* legacy: obj, showHidden, depth, colors*/
  function inspect$1(obj, opts) {
    // default options
    var ctx = {
      seen: [],
      stylize: stylizeNoColor
    };
    // legacy...
    if (arguments.length >= 3) ctx.depth = arguments[2];
    if (arguments.length >= 4) ctx.colors = arguments[3];
    if (isBoolean(opts)) {
      // legacy...
      ctx.showHidden = opts;
    } else if (opts) {
      // got an "options" object
      _extend(ctx, opts);
    }
    // set default options
    if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
    if (isUndefined(ctx.depth)) ctx.depth = 2;
    if (isUndefined(ctx.colors)) ctx.colors = false;
    if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
    if (ctx.colors) ctx.stylize = stylizeWithColor;
    return formatValue(ctx, obj, ctx.depth);
  }

  // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
  inspect$1.colors = {
    'bold' : [1, 22],
    'italic' : [3, 23],
    'underline' : [4, 24],
    'inverse' : [7, 27],
    'white' : [37, 39],
    'grey' : [90, 39],
    'black' : [30, 39],
    'blue' : [34, 39],
    'cyan' : [36, 39],
    'green' : [32, 39],
    'magenta' : [35, 39],
    'red' : [31, 39],
    'yellow' : [33, 39]
  };

  // Don't use 'blue' not visible on cmd.exe
  inspect$1.styles = {
    'special': 'cyan',
    'number': 'yellow',
    'boolean': 'yellow',
    'undefined': 'grey',
    'null': 'bold',
    'string': 'green',
    'date': 'magenta',
    // "name": intentionally not styling
    'regexp': 'red'
  };


  function stylizeWithColor(str, styleType) {
    var style = inspect$1.styles[styleType];

    if (style) {
      return '\u001b[' + inspect$1.colors[style][0] + 'm' + str +
             '\u001b[' + inspect$1.colors[style][1] + 'm';
    } else {
      return str;
    }
  }


  function stylizeNoColor(str, styleType) {
    return str;
  }


  function arrayToHash(array) {
    var hash = {};

    array.forEach(function(val, idx) {
      hash[val] = true;
    });

    return hash;
  }


  function formatValue(ctx, value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (ctx.customInspect &&
        value &&
        isFunction(value.inspect) &&
        // Filter out the util module, it's inspect function is special
        value.inspect !== inspect$1 &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      var ret = value.inspect(recurseTimes, ctx);
      if (!isString(ret)) {
        ret = formatValue(ctx, ret, recurseTimes);
      }
      return ret;
    }

    // Primitive types cannot have properties
    var primitive = formatPrimitive(ctx, value);
    if (primitive) {
      return primitive;
    }

    // Look up the keys of the object.
    var keys = Object.keys(value);
    var visibleKeys = arrayToHash(keys);

    if (ctx.showHidden) {
      keys = Object.getOwnPropertyNames(value);
    }

    // IE doesn't make error fields non-enumerable
    // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
    if (isError(value)
        && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
      return formatError(value);
    }

    // Some type of object without properties can be shortcutted.
    if (keys.length === 0) {
      if (isFunction(value)) {
        var name = value.name ? ': ' + value.name : '';
        return ctx.stylize('[Function' + name + ']', 'special');
      }
      if (isRegExp(value)) {
        return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
      }
      if (isDate(value)) {
        return ctx.stylize(Date.prototype.toString.call(value), 'date');
      }
      if (isError(value)) {
        return formatError(value);
      }
    }

    var base = '', array = false, braces = ['{', '}'];

    // Make Array say that they are Array
    if (isArray(value)) {
      array = true;
      braces = ['[', ']'];
    }

    // Make functions say that they are functions
    if (isFunction(value)) {
      var n = value.name ? ': ' + value.name : '';
      base = ' [Function' + n + ']';
    }

    // Make RegExps say that they are RegExps
    if (isRegExp(value)) {
      base = ' ' + RegExp.prototype.toString.call(value);
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + Date.prototype.toUTCString.call(value);
    }

    // Make error with message first say the error
    if (isError(value)) {
      base = ' ' + formatError(value);
    }

    if (keys.length === 0 && (!array || value.length == 0)) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
      } else {
        return ctx.stylize('[Object]', 'special');
      }
    }

    ctx.seen.push(value);

    var output;
    if (array) {
      output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
    } else {
      output = keys.map(function(key) {
        return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
      });
    }

    ctx.seen.pop();

    return reduceToSingleString(output, base, braces);
  }


  function formatPrimitive(ctx, value) {
    if (isUndefined(value))
      return ctx.stylize('undefined', 'undefined');
    if (isString(value)) {
      var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                               .replace(/'/g, "\\'")
                                               .replace(/\\"/g, '"') + '\'';
      return ctx.stylize(simple, 'string');
    }
    if (isNumber(value))
      return ctx.stylize('' + value, 'number');
    if (isBoolean(value))
      return ctx.stylize('' + value, 'boolean');
    // For some reason typeof null is "object", so special case here.
    if (isNull(value))
      return ctx.stylize('null', 'null');
  }


  function formatError(value) {
    return '[' + Error.prototype.toString.call(value) + ']';
  }


  function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
    var output = [];
    for (var i = 0, l = value.length; i < l; ++i) {
      if (hasOwnProperty(value, String(i))) {
        output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
            String(i), true));
      } else {
        output.push('');
      }
    }
    keys.forEach(function(key) {
      if (!key.match(/^\d+$/)) {
        output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
            key, true));
      }
    });
    return output;
  }


  function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
    var name, str, desc;
    desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
    if (desc.get) {
      if (desc.set) {
        str = ctx.stylize('[Getter/Setter]', 'special');
      } else {
        str = ctx.stylize('[Getter]', 'special');
      }
    } else {
      if (desc.set) {
        str = ctx.stylize('[Setter]', 'special');
      }
    }
    if (!hasOwnProperty(visibleKeys, key)) {
      name = '[' + key + ']';
    }
    if (!str) {
      if (ctx.seen.indexOf(desc.value) < 0) {
        if (isNull(recurseTimes)) {
          str = formatValue(ctx, desc.value, null);
        } else {
          str = formatValue(ctx, desc.value, recurseTimes - 1);
        }
        if (str.indexOf('\n') > -1) {
          if (array) {
            str = str.split('\n').map(function(line) {
              return '  ' + line;
            }).join('\n').substr(2);
          } else {
            str = '\n' + str.split('\n').map(function(line) {
              return '   ' + line;
            }).join('\n');
          }
        }
      } else {
        str = ctx.stylize('[Circular]', 'special');
      }
    }
    if (isUndefined(name)) {
      if (array && key.match(/^\d+$/)) {
        return str;
      }
      name = JSON.stringify('' + key);
      if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
        name = name.substr(1, name.length - 2);
        name = ctx.stylize(name, 'name');
      } else {
        name = name.replace(/'/g, "\\'")
                   .replace(/\\"/g, '"')
                   .replace(/(^"|"$)/g, "'");
        name = ctx.stylize(name, 'string');
      }
    }

    return name + ': ' + str;
  }


  function reduceToSingleString(output, base, braces) {
    var length = output.reduce(function(prev, cur) {
      if (cur.indexOf('\n') >= 0) ;
      return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
    }, 0);

    if (length > 60) {
      return braces[0] +
             (base === '' ? '' : base + '\n ') +
             ' ' +
             output.join(',\n  ') +
             ' ' +
             braces[1];
    }

    return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
  }


  // NOTE: These type checking functions intentionally don't use `instanceof`
  // because it is fragile and can be easily faked with `Object.create()`.
  function isArray(ar) {
    return Array.isArray(ar);
  }

  function isBoolean(arg) {
    return typeof arg === 'boolean';
  }

  function isNull(arg) {
    return arg === null;
  }

  function isNullOrUndefined(arg) {
    return arg == null;
  }

  function isNumber(arg) {
    return typeof arg === 'number';
  }

  function isString(arg) {
    return typeof arg === 'string';
  }

  function isSymbol(arg) {
    return typeof arg === 'symbol';
  }

  function isUndefined(arg) {
    return arg === void 0;
  }

  function isRegExp(re) {
    return isObject(re) && objectToString(re) === '[object RegExp]';
  }

  function isObject(arg) {
    return typeof arg === 'object' && arg !== null;
  }

  function isDate(d) {
    return isObject(d) && objectToString(d) === '[object Date]';
  }

  function isError(e) {
    return isObject(e) &&
        (objectToString(e) === '[object Error]' || e instanceof Error);
  }

  function isFunction(arg) {
    return typeof arg === 'function';
  }

  function isPrimitive(arg) {
    return arg === null ||
           typeof arg === 'boolean' ||
           typeof arg === 'number' ||
           typeof arg === 'string' ||
           typeof arg === 'symbol' ||  // ES6 symbol
           typeof arg === 'undefined';
  }

  function isBuffer(maybeBuf) {
    return Buffer.isBuffer(maybeBuf);
  }

  function objectToString(o) {
    return Object.prototype.toString.call(o);
  }


  function pad(n) {
    return n < 10 ? '0' + n.toString(10) : n.toString(10);
  }


  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
                'Oct', 'Nov', 'Dec'];

  // 26 Feb 16:19:34
  function timestamp() {
    var d = new Date();
    var time = [pad(d.getHours()),
                pad(d.getMinutes()),
                pad(d.getSeconds())].join(':');
    return [d.getDate(), months[d.getMonth()], time].join(' ');
  }


  // log is just a thin wrapper to console.log that prepends a timestamp
  function log() {
    console.log('%s - %s', timestamp(), format.apply(null, arguments));
  }

  function _extend(origin, add) {
    // Don't do anything if add isn't an object
    if (!add || !isObject(add)) return origin;

    var keys = Object.keys(add);
    var i = keys.length;
    while (i--) {
      origin[keys[i]] = add[keys[i]];
    }
    return origin;
  }
  function hasOwnProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }

  var kCustomPromisifiedSymbol = typeof Symbol !== 'undefined' ? Symbol('util.promisify.custom') : undefined;

  function promisify(original) {
    if (typeof original !== 'function')
      throw new TypeError('The "original" argument must be of type Function');

    if (kCustomPromisifiedSymbol && original[kCustomPromisifiedSymbol]) {
      var fn = original[kCustomPromisifiedSymbol];
      if (typeof fn !== 'function') {
        throw new TypeError('The "util.promisify.custom" argument must be of type Function');
      }
      Object.defineProperty(fn, kCustomPromisifiedSymbol, {
        value: fn, enumerable: false, writable: false, configurable: true
      });
      return fn;
    }

    function fn() {
      var promiseResolve, promiseReject;
      var promise = new Promise(function (resolve, reject) {
        promiseResolve = resolve;
        promiseReject = reject;
      });

      var args = [];
      for (var i = 0; i < arguments.length; i++) {
        args.push(arguments[i]);
      }
      args.push(function (err, value) {
        if (err) {
          promiseReject(err);
        } else {
          promiseResolve(value);
        }
      });

      try {
        original.apply(this, args);
      } catch (err) {
        promiseReject(err);
      }

      return promise;
    }

    Object.setPrototypeOf(fn, Object.getPrototypeOf(original));

    if (kCustomPromisifiedSymbol) Object.defineProperty(fn, kCustomPromisifiedSymbol, {
      value: fn, enumerable: false, writable: false, configurable: true
    });
    return Object.defineProperties(
      fn,
      getOwnPropertyDescriptors(original)
    );
  }

  promisify.custom = kCustomPromisifiedSymbol;

  function callbackifyOnRejected(reason, cb) {
    // `!reason` guard inspired by bluebird (Ref: https://goo.gl/t5IS6M).
    // Because `null` is a special error value in callbacks which means "no error
    // occurred", we error-wrap so the callback consumer can distinguish between
    // "the promise rejected with null" or "the promise fulfilled with undefined".
    if (!reason) {
      var newReason = new Error('Promise was rejected with a falsy value');
      newReason.reason = reason;
      reason = newReason;
    }
    return cb(reason);
  }

  function callbackify(original) {
    if (typeof original !== 'function') {
      throw new TypeError('The "original" argument must be of type Function');
    }

    // We DO NOT return the promise as it gives the user a false sense that
    // the promise is actually somehow related to the callback's execution
    // and that the callback throwing will reject the promise.
    function callbackified() {
      var args = [];
      for (var i = 0; i < arguments.length; i++) {
        args.push(arguments[i]);
      }

      var maybeCb = args.pop();
      if (typeof maybeCb !== 'function') {
        throw new TypeError('The last argument must be of type Function');
      }
      var self = this;
      var cb = function() {
        return maybeCb.apply(self, arguments);
      };
      // In true node style we process the callback on `nextTick` with all the
      // implications (stack, `uncaughtException`, `async_hooks`)
      original.apply(this, args)
        .then(function(ret) { browser$1$1.nextTick(cb.bind(null, null, ret)); },
          function(rej) { browser$1$1.nextTick(callbackifyOnRejected.bind(null, rej, cb)); });
    }

    Object.setPrototypeOf(callbackified, Object.getPrototypeOf(original));
    Object.defineProperties(callbackified, getOwnPropertyDescriptors(original));
    return callbackified;
  }

  var _polyfillNode_util = {
    inherits: inherits,
    _extend: _extend,
    log: log,
    isBuffer: isBuffer,
    isPrimitive: isPrimitive,
    isFunction: isFunction,
    isError: isError,
    isDate: isDate,
    isObject: isObject,
    isRegExp: isRegExp,
    isUndefined: isUndefined,
    isSymbol: isSymbol,
    isString: isString,
    isNumber: isNumber,
    isNullOrUndefined: isNullOrUndefined,
    isNull: isNull,
    isBoolean: isBoolean,
    isArray: isArray,
    inspect: inspect$1,
    deprecate: deprecate,
    format: format,
    debuglog: debuglog,
    promisify: promisify,
    callbackify: callbackify,
  };

  var _polyfillNode_util$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    _extend: _extend,
    callbackify: callbackify,
    debuglog: debuglog,
    default: _polyfillNode_util,
    deprecate: deprecate,
    format: format,
    inherits: inherits,
    inspect: inspect$1,
    isArray: isArray,
    isBoolean: isBoolean,
    isBuffer: isBuffer,
    isDate: isDate,
    isError: isError,
    isFunction: isFunction,
    isNull: isNull,
    isNullOrUndefined: isNullOrUndefined,
    isNumber: isNumber,
    isObject: isObject,
    isPrimitive: isPrimitive,
    isRegExp: isRegExp,
    isString: isString,
    isSymbol: isSymbol,
    isUndefined: isUndefined,
    log: log,
    promisify: promisify
  });

  var require$$0$2 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_util$1);

  var domain;

  // This constructor is used to store event handlers. Instantiating this is
  // faster than explicitly calling `Object.create(null)` to get a "clean" empty
  // object (tested with v8 v4.9).
  function EventHandlers() {}
  EventHandlers.prototype = Object.create(null);

  function EventEmitter() {
    EventEmitter.init.call(this);
  }

  // nodejs oddity
  // require('events') === require('events').EventEmitter
  EventEmitter.EventEmitter = EventEmitter;

  EventEmitter.usingDomains = false;

  EventEmitter.prototype.domain = undefined;
  EventEmitter.prototype._events = undefined;
  EventEmitter.prototype._maxListeners = undefined;

  // By default EventEmitters will print a warning if more than 10 listeners are
  // added to it. This is a useful default which helps finding memory leaks.
  EventEmitter.defaultMaxListeners = 10;

  EventEmitter.init = function() {
    this.domain = null;
    if (EventEmitter.usingDomains) {
      // if there is an active domain, then attach to it.
      if (domain.active && !(this instanceof domain.Domain)) {
        this.domain = domain.active;
      }
    }

    if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
      this._events = new EventHandlers();
      this._eventsCount = 0;
    }

    this._maxListeners = this._maxListeners || undefined;
  };

  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.
  EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
    if (typeof n !== 'number' || n < 0 || isNaN(n))
      throw new TypeError('"n" argument must be a positive number');
    this._maxListeners = n;
    return this;
  };

  function $getMaxListeners(that) {
    if (that._maxListeners === undefined)
      return EventEmitter.defaultMaxListeners;
    return that._maxListeners;
  }

  EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
    return $getMaxListeners(this);
  };

  // These standalone emit* functions are used to optimize calling of event
  // handlers for fast cases because emit() itself often has a variable number of
  // arguments and can be deoptimized because of that. These functions always have
  // the same number of arguments and thus do not get deoptimized, so the code
  // inside them can execute faster.
  function emitNone(handler, isFn, self) {
    if (isFn)
      handler.call(self);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self);
    }
  }
  function emitOne(handler, isFn, self, arg1) {
    if (isFn)
      handler.call(self, arg1);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self, arg1);
    }
  }
  function emitTwo(handler, isFn, self, arg1, arg2) {
    if (isFn)
      handler.call(self, arg1, arg2);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self, arg1, arg2);
    }
  }
  function emitThree(handler, isFn, self, arg1, arg2, arg3) {
    if (isFn)
      handler.call(self, arg1, arg2, arg3);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self, arg1, arg2, arg3);
    }
  }

  function emitMany(handler, isFn, self, args) {
    if (isFn)
      handler.apply(self, args);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].apply(self, args);
    }
  }

  EventEmitter.prototype.emit = function emit(type) {
    var er, handler, len, args, i, events, domain;
    var doError = (type === 'error');

    events = this._events;
    if (events)
      doError = (doError && events.error == null);
    else if (!doError)
      return false;

    domain = this.domain;

    // If there is no 'error' event listener then throw.
    if (doError) {
      er = arguments[1];
      if (domain) {
        if (!er)
          er = new Error('Uncaught, unspecified "error" event');
        er.domainEmitter = this;
        er.domain = domain;
        er.domainThrown = false;
        domain.emit('error', er);
      } else if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
      return false;
    }

    handler = events[type];

    if (!handler)
      return false;

    var isFn = typeof handler === 'function';
    len = arguments.length;
    switch (len) {
      // fast cases
      case 1:
        emitNone(handler, isFn, this);
        break;
      case 2:
        emitOne(handler, isFn, this, arguments[1]);
        break;
      case 3:
        emitTwo(handler, isFn, this, arguments[1], arguments[2]);
        break;
      case 4:
        emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
        break;
      // slower
      default:
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        emitMany(handler, isFn, this, args);
    }

    return true;
  };

  function _addListener(target, type, listener, prepend) {
    var m;
    var events;
    var existing;

    if (typeof listener !== 'function')
      throw new TypeError('"listener" argument must be a function');

    events = target._events;
    if (!events) {
      events = target._events = new EventHandlers();
      target._eventsCount = 0;
    } else {
      // To avoid recursion in the case that type === "newListener"! Before
      // adding it to the listeners, first emit "newListener".
      if (events.newListener) {
        target.emit('newListener', type,
                    listener.listener ? listener.listener : listener);

        // Re-assign `events` because a newListener handler could have caused the
        // this._events to be assigned to a new object
        events = target._events;
      }
      existing = events[type];
    }

    if (!existing) {
      // Optimize the case of one listener. Don't need the extra array object.
      existing = events[type] = listener;
      ++target._eventsCount;
    } else {
      if (typeof existing === 'function') {
        // Adding the second element, need to change to array.
        existing = events[type] = prepend ? [listener, existing] :
                                            [existing, listener];
      } else {
        // If we've already got an array, just append.
        if (prepend) {
          existing.unshift(listener);
        } else {
          existing.push(listener);
        }
      }

      // Check for listener leak
      if (!existing.warned) {
        m = $getMaxListeners(target);
        if (m && m > 0 && existing.length > m) {
          existing.warned = true;
          var w = new Error('Possible EventEmitter memory leak detected. ' +
                              existing.length + ' ' + type + ' listeners added. ' +
                              'Use emitter.setMaxListeners() to increase limit');
          w.name = 'MaxListenersExceededWarning';
          w.emitter = target;
          w.type = type;
          w.count = existing.length;
          emitWarning(w);
        }
      }
    }

    return target;
  }
  function emitWarning(e) {
    typeof console.warn === 'function' ? console.warn(e) : console.log(e);
  }
  EventEmitter.prototype.addListener = function addListener(type, listener) {
    return _addListener(this, type, listener, false);
  };

  EventEmitter.prototype.on = EventEmitter.prototype.addListener;

  EventEmitter.prototype.prependListener =
      function prependListener(type, listener) {
        return _addListener(this, type, listener, true);
      };

  function _onceWrap(target, type, listener) {
    var fired = false;
    function g() {
      target.removeListener(type, g);
      if (!fired) {
        fired = true;
        listener.apply(target, arguments);
      }
    }
    g.listener = listener;
    return g;
  }

  EventEmitter.prototype.once = function once(type, listener) {
    if (typeof listener !== 'function')
      throw new TypeError('"listener" argument must be a function');
    this.on(type, _onceWrap(this, type, listener));
    return this;
  };

  EventEmitter.prototype.prependOnceListener =
      function prependOnceListener(type, listener) {
        if (typeof listener !== 'function')
          throw new TypeError('"listener" argument must be a function');
        this.prependListener(type, _onceWrap(this, type, listener));
        return this;
      };

  // emits a 'removeListener' event iff the listener was removed
  EventEmitter.prototype.removeListener =
      function removeListener(type, listener) {
        var list, events, position, i, originalListener;

        if (typeof listener !== 'function')
          throw new TypeError('"listener" argument must be a function');

        events = this._events;
        if (!events)
          return this;

        list = events[type];
        if (!list)
          return this;

        if (list === listener || (list.listener && list.listener === listener)) {
          if (--this._eventsCount === 0)
            this._events = new EventHandlers();
          else {
            delete events[type];
            if (events.removeListener)
              this.emit('removeListener', type, list.listener || listener);
          }
        } else if (typeof list !== 'function') {
          position = -1;

          for (i = list.length; i-- > 0;) {
            if (list[i] === listener ||
                (list[i].listener && list[i].listener === listener)) {
              originalListener = list[i].listener;
              position = i;
              break;
            }
          }

          if (position < 0)
            return this;

          if (list.length === 1) {
            list[0] = undefined;
            if (--this._eventsCount === 0) {
              this._events = new EventHandlers();
              return this;
            } else {
              delete events[type];
            }
          } else {
            spliceOne(list, position);
          }

          if (events.removeListener)
            this.emit('removeListener', type, originalListener || listener);
        }

        return this;
      };
      
  // Alias for removeListener added in NodeJS 10.0
  // https://nodejs.org/api/events.html#events_emitter_off_eventname_listener
  EventEmitter.prototype.off = function(type, listener){
      return this.removeListener(type, listener);
  };

  EventEmitter.prototype.removeAllListeners =
      function removeAllListeners(type) {
        var listeners, events;

        events = this._events;
        if (!events)
          return this;

        // not listening for removeListener, no need to emit
        if (!events.removeListener) {
          if (arguments.length === 0) {
            this._events = new EventHandlers();
            this._eventsCount = 0;
          } else if (events[type]) {
            if (--this._eventsCount === 0)
              this._events = new EventHandlers();
            else
              delete events[type];
          }
          return this;
        }

        // emit removeListener for all listeners on all events
        if (arguments.length === 0) {
          var keys = Object.keys(events);
          for (var i = 0, key; i < keys.length; ++i) {
            key = keys[i];
            if (key === 'removeListener') continue;
            this.removeAllListeners(key);
          }
          this.removeAllListeners('removeListener');
          this._events = new EventHandlers();
          this._eventsCount = 0;
          return this;
        }

        listeners = events[type];

        if (typeof listeners === 'function') {
          this.removeListener(type, listeners);
        } else if (listeners) {
          // LIFO order
          do {
            this.removeListener(type, listeners[listeners.length - 1]);
          } while (listeners[0]);
        }

        return this;
      };

  EventEmitter.prototype.listeners = function listeners(type) {
    var evlistener;
    var ret;
    var events = this._events;

    if (!events)
      ret = [];
    else {
      evlistener = events[type];
      if (!evlistener)
        ret = [];
      else if (typeof evlistener === 'function')
        ret = [evlistener.listener || evlistener];
      else
        ret = unwrapListeners(evlistener);
    }

    return ret;
  };

  EventEmitter.listenerCount = function(emitter, type) {
    if (typeof emitter.listenerCount === 'function') {
      return emitter.listenerCount(type);
    } else {
      return listenerCount$1.call(emitter, type);
    }
  };

  EventEmitter.prototype.listenerCount = listenerCount$1;
  function listenerCount$1(type) {
    var events = this._events;

    if (events) {
      var evlistener = events[type];

      if (typeof evlistener === 'function') {
        return 1;
      } else if (evlistener) {
        return evlistener.length;
      }
    }

    return 0;
  }

  EventEmitter.prototype.eventNames = function eventNames() {
    return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
  };

  // About 1.5x faster than the two-arg version of Array#splice().
  function spliceOne(list, index) {
    for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
      list[i] = list[k];
    list.pop();
  }

  function arrayClone(arr, i) {
    var copy = new Array(i);
    while (i--)
      copy[i] = arr[i];
    return copy;
  }

  function unwrapListeners(arr) {
    var ret = new Array(arr.length);
    for (var i = 0; i < ret.length; ++i) {
      ret[i] = arr[i].listener || arr[i];
    }
    return ret;
  }

  function BufferList() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  BufferList.prototype.push = function (v) {
    var entry = { data: v, next: null };
    if (this.length > 0) this.tail.next = entry;else this.head = entry;
    this.tail = entry;
    ++this.length;
  };

  BufferList.prototype.unshift = function (v) {
    var entry = { data: v, next: this.head };
    if (this.length === 0) this.tail = entry;
    this.head = entry;
    ++this.length;
  };

  BufferList.prototype.shift = function () {
    if (this.length === 0) return;
    var ret = this.head.data;
    if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
    --this.length;
    return ret;
  };

  BufferList.prototype.clear = function () {
    this.head = this.tail = null;
    this.length = 0;
  };

  BufferList.prototype.join = function (s) {
    if (this.length === 0) return '';
    var p = this.head;
    var ret = '' + p.data;
    while (p = p.next) {
      ret += s + p.data;
    }return ret;
  };

  BufferList.prototype.concat = function (n) {
    if (this.length === 0) return Buffer.alloc(0);
    if (this.length === 1) return this.head.data;
    var ret = Buffer.allocUnsafe(n >>> 0);
    var p = this.head;
    var i = 0;
    while (p) {
      p.data.copy(ret, i);
      i += p.data.length;
      p = p.next;
    }
    return ret;
  };

  // Copyright Joyent, Inc. and other Node contributors.
  //
  // Permission is hereby granted, free of charge, to any person obtaining a
  // copy of this software and associated documentation files (the
  // "Software"), to deal in the Software without restriction, including
  // without limitation the rights to use, copy, modify, merge, publish,
  // distribute, sublicense, and/or sell copies of the Software, and to permit
  // persons to whom the Software is furnished to do so, subject to the
  // following conditions:
  //
  // The above copyright notice and this permission notice shall be included
  // in all copies or substantial portions of the Software.
  //
  // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
  // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
  // USE OR OTHER DEALINGS IN THE SOFTWARE.

  var isBufferEncoding = Buffer.isEncoding
    || function(encoding) {
         switch (encoding && encoding.toLowerCase()) {
           case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
           default: return false;
         }
       };


  function assertEncoding(encoding) {
    if (encoding && !isBufferEncoding(encoding)) {
      throw new Error('Unknown encoding: ' + encoding);
    }
  }

  // StringDecoder provides an interface for efficiently splitting a series of
  // buffers into a series of JS strings without breaking apart multi-byte
  // characters. CESU-8 is handled as part of the UTF-8 encoding.
  //
  // @TODO Handling all encodings inside a single object makes it very difficult
  // to reason about this code, so it should be split up in the future.
  // @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
  // points as used by CESU-8.
  function StringDecoder(encoding) {
    this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
    assertEncoding(encoding);
    switch (this.encoding) {
      case 'utf8':
        // CESU-8 represents each of Surrogate Pair by 3-bytes
        this.surrogateSize = 3;
        break;
      case 'ucs2':
      case 'utf16le':
        // UTF-16 represents each of Surrogate Pair by 2-bytes
        this.surrogateSize = 2;
        this.detectIncompleteChar = utf16DetectIncompleteChar;
        break;
      case 'base64':
        // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
        this.surrogateSize = 3;
        this.detectIncompleteChar = base64DetectIncompleteChar;
        break;
      default:
        this.write = passThroughWrite;
        return;
    }

    // Enough space to store all bytes of a single character. UTF-8 needs 4
    // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
    this.charBuffer = new Buffer(6);
    // Number of bytes received for the current incomplete multi-byte character.
    this.charReceived = 0;
    // Number of bytes expected for the current incomplete multi-byte character.
    this.charLength = 0;
  }

  // write decodes the given buffer and returns it as JS string that is
  // guaranteed to not contain any partial multi-byte characters. Any partial
  // character found at the end of the buffer is buffered up, and will be
  // returned when calling write again with the remaining bytes.
  //
  // Note: Converting a Buffer containing an orphan surrogate to a String
  // currently works, but converting a String to a Buffer (via `new Buffer`, or
  // Buffer#write) will replace incomplete surrogates with the unicode
  // replacement character. See https://codereview.chromium.org/121173009/ .
  StringDecoder.prototype.write = function(buffer) {
    var charStr = '';
    // if our last write ended with an incomplete multibyte character
    while (this.charLength) {
      // determine how many remaining bytes this buffer has to offer for this char
      var available = (buffer.length >= this.charLength - this.charReceived) ?
          this.charLength - this.charReceived :
          buffer.length;

      // add the new bytes to the char buffer
      buffer.copy(this.charBuffer, this.charReceived, 0, available);
      this.charReceived += available;

      if (this.charReceived < this.charLength) {
        // still not enough chars in this buffer? wait for more ...
        return '';
      }

      // remove bytes belonging to the current character from the buffer
      buffer = buffer.slice(available, buffer.length);

      // get the character that was split
      charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

      // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
      var charCode = charStr.charCodeAt(charStr.length - 1);
      if (charCode >= 0xD800 && charCode <= 0xDBFF) {
        this.charLength += this.surrogateSize;
        charStr = '';
        continue;
      }
      this.charReceived = this.charLength = 0;

      // if there are no more bytes in this buffer, just emit our char
      if (buffer.length === 0) {
        return charStr;
      }
      break;
    }

    // determine and set charLength / charReceived
    this.detectIncompleteChar(buffer);

    var end = buffer.length;
    if (this.charLength) {
      // buffer the incomplete character bytes we got
      buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
      end -= this.charReceived;
    }

    charStr += buffer.toString(this.encoding, 0, end);

    var end = charStr.length - 1;
    var charCode = charStr.charCodeAt(end);
    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      var size = this.surrogateSize;
      this.charLength += size;
      this.charReceived += size;
      this.charBuffer.copy(this.charBuffer, size, 0, size);
      buffer.copy(this.charBuffer, 0, 0, size);
      return charStr.substring(0, end);
    }

    // or just emit the charStr
    return charStr;
  };

  // detectIncompleteChar determines if there is an incomplete UTF-8 character at
  // the end of the given buffer. If so, it sets this.charLength to the byte
  // length that character, and sets this.charReceived to the number of bytes
  // that are available for this character.
  StringDecoder.prototype.detectIncompleteChar = function(buffer) {
    // determine how many bytes we have to check at the end of this buffer
    var i = (buffer.length >= 3) ? 3 : buffer.length;

    // Figure out if one of the last i bytes of our buffer announces an
    // incomplete char.
    for (; i > 0; i--) {
      var c = buffer[buffer.length - i];

      // See http://en.wikipedia.org/wiki/UTF-8#Description

      // 110XXXXX
      if (i == 1 && c >> 5 == 0x06) {
        this.charLength = 2;
        break;
      }

      // 1110XXXX
      if (i <= 2 && c >> 4 == 0x0E) {
        this.charLength = 3;
        break;
      }

      // 11110XXX
      if (i <= 3 && c >> 3 == 0x1E) {
        this.charLength = 4;
        break;
      }
    }
    this.charReceived = i;
  };

  StringDecoder.prototype.end = function(buffer) {
    var res = '';
    if (buffer && buffer.length)
      res = this.write(buffer);

    if (this.charReceived) {
      var cr = this.charReceived;
      var buf = this.charBuffer;
      var enc = this.encoding;
      res += buf.slice(0, cr).toString(enc);
    }

    return res;
  };

  function passThroughWrite(buffer) {
    return buffer.toString(this.encoding);
  }

  function utf16DetectIncompleteChar(buffer) {
    this.charReceived = buffer.length % 2;
    this.charLength = this.charReceived ? 2 : 0;
  }

  function base64DetectIncompleteChar(buffer) {
    this.charReceived = buffer.length % 3;
    this.charLength = this.charReceived ? 3 : 0;
  }

  Readable.ReadableState = ReadableState;

  var debug = debuglog('stream');
  inherits(Readable, EventEmitter);

  function prependListener(emitter, event, fn) {
    // Sadly this is not cacheable as some libraries bundle their own
    // event emitter implementation with them.
    if (typeof emitter.prependListener === 'function') {
      return emitter.prependListener(event, fn);
    } else {
      // This is a hack to make sure that our error handler is attached before any
      // userland ones.  NEVER DO THIS. This is here only because this code needs
      // to continue to work with older versions of Node.js that do not include
      // the prependListener() method. The goal is to eventually remove this hack.
      if (!emitter._events || !emitter._events[event])
        emitter.on(event, fn);
      else if (Array.isArray(emitter._events[event]))
        emitter._events[event].unshift(fn);
      else
        emitter._events[event] = [fn, emitter._events[event]];
    }
  }
  function listenerCount (emitter, type) {
    return emitter.listeners(type).length;
  }
  function ReadableState(options, stream) {

    options = options || {};

    // object stream flag. Used to make read(n) ignore n and to
    // make all the buffer merging and length checks go away
    this.objectMode = !!options.objectMode;

    if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

    // the point at which it stops calling _read() to fill the buffer
    // Note: 0 is a valid value, means "don't call _read preemptively ever"
    var hwm = options.highWaterMark;
    var defaultHwm = this.objectMode ? 16 : 16 * 1024;
    this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

    // cast to ints.
    this.highWaterMark = ~ ~this.highWaterMark;

    // A linked list is used to store data chunks instead of an array because the
    // linked list can remove elements from the beginning faster than
    // array.shift()
    this.buffer = new BufferList();
    this.length = 0;
    this.pipes = null;
    this.pipesCount = 0;
    this.flowing = null;
    this.ended = false;
    this.endEmitted = false;
    this.reading = false;

    // a flag to be able to tell if the onwrite cb is called immediately,
    // or on a later tick.  We set this to true at first, because any
    // actions that shouldn't happen until "later" should generally also
    // not happen before the first write call.
    this.sync = true;

    // whenever we return null, then we set a flag to say
    // that we're awaiting a 'readable' event emission.
    this.needReadable = false;
    this.emittedReadable = false;
    this.readableListening = false;
    this.resumeScheduled = false;

    // Crypto is kind of old and crusty.  Historically, its default string
    // encoding is 'binary' so we have to make this configurable.
    // Everything else in the universe uses 'utf8', though.
    this.defaultEncoding = options.defaultEncoding || 'utf8';

    // when piping, we only care about 'readable' events that happen
    // after read()ing all the bytes and not getting any pushback.
    this.ranOut = false;

    // the number of writers that are awaiting a drain event in .pipe()s
    this.awaitDrain = 0;

    // if true, a maybeReadMore has been scheduled
    this.readingMore = false;

    this.decoder = null;
    this.encoding = null;
    if (options.encoding) {
      this.decoder = new StringDecoder(options.encoding);
      this.encoding = options.encoding;
    }
  }
  function Readable(options) {

    if (!(this instanceof Readable)) return new Readable(options);

    this._readableState = new ReadableState(options, this);

    // legacy
    this.readable = true;

    if (options && typeof options.read === 'function') this._read = options.read;

    EventEmitter.call(this);
  }

  // Manually shove something into the read() buffer.
  // This returns true if the highWaterMark has not been hit yet,
  // similar to how Writable.write() returns true if you should
  // write() some more.
  Readable.prototype.push = function (chunk, encoding) {
    var state = this._readableState;

    if (!state.objectMode && typeof chunk === 'string') {
      encoding = encoding || state.defaultEncoding;
      if (encoding !== state.encoding) {
        chunk = Buffer.from(chunk, encoding);
        encoding = '';
      }
    }

    return readableAddChunk(this, state, chunk, encoding, false);
  };

  // Unshift should *always* be something directly out of read()
  Readable.prototype.unshift = function (chunk) {
    var state = this._readableState;
    return readableAddChunk(this, state, chunk, '', true);
  };

  Readable.prototype.isPaused = function () {
    return this._readableState.flowing === false;
  };

  function readableAddChunk(stream, state, chunk, encoding, addToFront) {
    var er = chunkInvalid(state, chunk);
    if (er) {
      stream.emit('error', er);
    } else if (chunk === null) {
      state.reading = false;
      onEofChunk(stream, state);
    } else if (state.objectMode || chunk && chunk.length > 0) {
      if (state.ended && !addToFront) {
        var e = new Error('stream.push() after EOF');
        stream.emit('error', e);
      } else if (state.endEmitted && addToFront) {
        var _e = new Error('stream.unshift() after end event');
        stream.emit('error', _e);
      } else {
        var skipAdd;
        if (state.decoder && !addToFront && !encoding) {
          chunk = state.decoder.write(chunk);
          skipAdd = !state.objectMode && chunk.length === 0;
        }

        if (!addToFront) state.reading = false;

        // Don't add to the buffer if we've decoded to an empty string chunk and
        // we're not in object mode
        if (!skipAdd) {
          // if we want the data now, just emit it.
          if (state.flowing && state.length === 0 && !state.sync) {
            stream.emit('data', chunk);
            stream.read(0);
          } else {
            // update the buffer info.
            state.length += state.objectMode ? 1 : chunk.length;
            if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

            if (state.needReadable) emitReadable(stream);
          }
        }

        maybeReadMore(stream, state);
      }
    } else if (!addToFront) {
      state.reading = false;
    }

    return needMoreData(state);
  }

  // if it's past the high water mark, we can push in some more.
  // Also, if we have no data yet, we can stand some
  // more bytes.  This is to work around cases where hwm=0,
  // such as the repl.  Also, if the push() triggered a
  // readable event, and the user called read(largeNumber) such that
  // needReadable was set, then we ought to push more, so that another
  // 'readable' event will be triggered.
  function needMoreData(state) {
    return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
  }

  // backwards compatibility.
  Readable.prototype.setEncoding = function (enc) {
    this._readableState.decoder = new StringDecoder(enc);
    this._readableState.encoding = enc;
    return this;
  };

  // Don't raise the hwm > 8MB
  var MAX_HWM = 0x800000;
  function computeNewHighWaterMark(n) {
    if (n >= MAX_HWM) {
      n = MAX_HWM;
    } else {
      // Get the next highest power of 2 to prevent increasing hwm excessively in
      // tiny amounts
      n--;
      n |= n >>> 1;
      n |= n >>> 2;
      n |= n >>> 4;
      n |= n >>> 8;
      n |= n >>> 16;
      n++;
    }
    return n;
  }

  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function howMuchToRead(n, state) {
    if (n <= 0 || state.length === 0 && state.ended) return 0;
    if (state.objectMode) return 1;
    if (n !== n) {
      // Only flow one buffer at a time
      if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
    }
    // If we're asking for more than the current hwm, then raise the hwm.
    if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
    if (n <= state.length) return n;
    // Don't have enough
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    }
    return state.length;
  }

  // you can override either this method, or the async _read(n) below.
  Readable.prototype.read = function (n) {
    debug('read', n);
    n = parseInt(n, 10);
    var state = this._readableState;
    var nOrig = n;

    if (n !== 0) state.emittedReadable = false;

    // if we're doing read(0) to trigger a readable event, but we
    // already have a bunch of data in the buffer, then just trigger
    // the 'readable' event and move on.
    if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
      debug('read: emitReadable', state.length, state.ended);
      if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
      return null;
    }

    n = howMuchToRead(n, state);

    // if we've ended, and we're now clear, then finish it up.
    if (n === 0 && state.ended) {
      if (state.length === 0) endReadable(this);
      return null;
    }

    // All the actual chunk generation logic needs to be
    // *below* the call to _read.  The reason is that in certain
    // synthetic stream cases, such as passthrough streams, _read
    // may be a completely synchronous operation which may change
    // the state of the read buffer, providing enough data when
    // before there was *not* enough.
    //
    // So, the steps are:
    // 1. Figure out what the state of things will be after we do
    // a read from the buffer.
    //
    // 2. If that resulting state will trigger a _read, then call _read.
    // Note that this may be asynchronous, or synchronous.  Yes, it is
    // deeply ugly to write APIs this way, but that still doesn't mean
    // that the Readable class should behave improperly, as streams are
    // designed to be sync/async agnostic.
    // Take note if the _read call is sync or async (ie, if the read call
    // has returned yet), so that we know whether or not it's safe to emit
    // 'readable' etc.
    //
    // 3. Actually pull the requested chunks out of the buffer and return.

    // if we need a readable event, then we need to do some reading.
    var doRead = state.needReadable;
    debug('need readable', doRead);

    // if we currently have less than the highWaterMark, then also read some
    if (state.length === 0 || state.length - n < state.highWaterMark) {
      doRead = true;
      debug('length less than watermark', doRead);
    }

    // however, if we've ended, then there's no point, and if we're already
    // reading, then it's unnecessary.
    if (state.ended || state.reading) {
      doRead = false;
      debug('reading or ended', doRead);
    } else if (doRead) {
      debug('do read');
      state.reading = true;
      state.sync = true;
      // if the length is currently zero, then we *need* a readable event.
      if (state.length === 0) state.needReadable = true;
      // call internal read method
      this._read(state.highWaterMark);
      state.sync = false;
      // If _read pushed data synchronously, then `reading` will be false,
      // and we need to re-evaluate how much data we can return to the user.
      if (!state.reading) n = howMuchToRead(nOrig, state);
    }

    var ret;
    if (n > 0) ret = fromList(n, state);else ret = null;

    if (ret === null) {
      state.needReadable = true;
      n = 0;
    } else {
      state.length -= n;
    }

    if (state.length === 0) {
      // If we have nothing in the buffer, then we want to know
      // as soon as we *do* get something into the buffer.
      if (!state.ended) state.needReadable = true;

      // If we tried to read() past the EOF, then emit end on the next tick.
      if (nOrig !== n && state.ended) endReadable(this);
    }

    if (ret !== null) this.emit('data', ret);

    return ret;
  };

  function chunkInvalid(state, chunk) {
    var er = null;
    if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== null && chunk !== undefined && !state.objectMode) {
      er = new TypeError('Invalid non-string/buffer chunk');
    }
    return er;
  }

  function onEofChunk(stream, state) {
    if (state.ended) return;
    if (state.decoder) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) {
        state.buffer.push(chunk);
        state.length += state.objectMode ? 1 : chunk.length;
      }
    }
    state.ended = true;

    // emit 'readable' now to make sure it gets picked up.
    emitReadable(stream);
  }

  // Don't emit readable right away in sync mode, because this can trigger
  // another read() call => stack overflow.  This way, it might trigger
  // a nextTick recursion warning, but that's not so bad.
  function emitReadable(stream) {
    var state = stream._readableState;
    state.needReadable = false;
    if (!state.emittedReadable) {
      debug('emitReadable', state.flowing);
      state.emittedReadable = true;
      if (state.sync) nextTick(emitReadable_, stream);else emitReadable_(stream);
    }
  }

  function emitReadable_(stream) {
    debug('emit readable');
    stream.emit('readable');
    flow(stream);
  }

  // at this point, the user has presumably seen the 'readable' event,
  // and called read() to consume some data.  that may have triggered
  // in turn another _read(n) call, in which case reading = true if
  // it's in progress.
  // However, if we're not ended, or reading, and the length < hwm,
  // then go ahead and try to read some more preemptively.
  function maybeReadMore(stream, state) {
    if (!state.readingMore) {
      state.readingMore = true;
      nextTick(maybeReadMore_, stream, state);
    }
  }

  function maybeReadMore_(stream, state) {
    var len = state.length;
    while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
      debug('maybeReadMore read 0');
      stream.read(0);
      if (len === state.length)
        // didn't get any data, stop spinning.
        break;else len = state.length;
    }
    state.readingMore = false;
  }

  // abstract method.  to be overridden in specific implementation classes.
  // call cb(er, data) where data is <= n in length.
  // for virtual (non-string, non-buffer) streams, "length" is somewhat
  // arbitrary, and perhaps not very meaningful.
  Readable.prototype._read = function (n) {
    this.emit('error', new Error('not implemented'));
  };

  Readable.prototype.pipe = function (dest, pipeOpts) {
    var src = this;
    var state = this._readableState;

    switch (state.pipesCount) {
      case 0:
        state.pipes = dest;
        break;
      case 1:
        state.pipes = [state.pipes, dest];
        break;
      default:
        state.pipes.push(dest);
        break;
    }
    state.pipesCount += 1;
    debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

    var doEnd = (!pipeOpts || pipeOpts.end !== false);

    var endFn = doEnd ? onend : cleanup;
    if (state.endEmitted) nextTick(endFn);else src.once('end', endFn);

    dest.on('unpipe', onunpipe);
    function onunpipe(readable) {
      debug('onunpipe');
      if (readable === src) {
        cleanup();
      }
    }

    function onend() {
      debug('onend');
      dest.end();
    }

    // when the dest drains, it reduces the awaitDrain counter
    // on the source.  This would be more elegant with a .once()
    // handler in flow(), but adding and removing repeatedly is
    // too slow.
    var ondrain = pipeOnDrain(src);
    dest.on('drain', ondrain);

    var cleanedUp = false;
    function cleanup() {
      debug('cleanup');
      // cleanup event handlers once the pipe is broken
      dest.removeListener('close', onclose);
      dest.removeListener('finish', onfinish);
      dest.removeListener('drain', ondrain);
      dest.removeListener('error', onerror);
      dest.removeListener('unpipe', onunpipe);
      src.removeListener('end', onend);
      src.removeListener('end', cleanup);
      src.removeListener('data', ondata);

      cleanedUp = true;

      // if the reader is waiting for a drain event from this
      // specific writer, then it would cause it to never start
      // flowing again.
      // So, if this is awaiting a drain, then we just call it now.
      // If we don't know, then assume that we are waiting for one.
      if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
    }

    // If the user pushes more data while we're writing to dest then we'll end up
    // in ondata again. However, we only want to increase awaitDrain once because
    // dest will only emit one 'drain' event for the multiple writes.
    // => Introduce a guard on increasing awaitDrain.
    var increasedAwaitDrain = false;
    src.on('data', ondata);
    function ondata(chunk) {
      debug('ondata');
      increasedAwaitDrain = false;
      var ret = dest.write(chunk);
      if (false === ret && !increasedAwaitDrain) {
        // If the user unpiped during `dest.write()`, it is possible
        // to get stuck in a permanently paused state if that write
        // also returned false.
        // => Check whether `dest` is still a piping destination.
        if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
          debug('false write response, pause', src._readableState.awaitDrain);
          src._readableState.awaitDrain++;
          increasedAwaitDrain = true;
        }
        src.pause();
      }
    }

    // if the dest has an error, then stop piping into it.
    // however, don't suppress the throwing behavior for this.
    function onerror(er) {
      debug('onerror', er);
      unpipe();
      dest.removeListener('error', onerror);
      if (listenerCount(dest, 'error') === 0) dest.emit('error', er);
    }

    // Make sure our error handler is attached before userland ones.
    prependListener(dest, 'error', onerror);

    // Both close and finish should trigger unpipe, but only once.
    function onclose() {
      dest.removeListener('finish', onfinish);
      unpipe();
    }
    dest.once('close', onclose);
    function onfinish() {
      debug('onfinish');
      dest.removeListener('close', onclose);
      unpipe();
    }
    dest.once('finish', onfinish);

    function unpipe() {
      debug('unpipe');
      src.unpipe(dest);
    }

    // tell the dest that it's being piped to
    dest.emit('pipe', src);

    // start the flow if it hasn't been started already.
    if (!state.flowing) {
      debug('pipe resume');
      src.resume();
    }

    return dest;
  };

  function pipeOnDrain(src) {
    return function () {
      var state = src._readableState;
      debug('pipeOnDrain', state.awaitDrain);
      if (state.awaitDrain) state.awaitDrain--;
      if (state.awaitDrain === 0 && src.listeners('data').length) {
        state.flowing = true;
        flow(src);
      }
    };
  }

  Readable.prototype.unpipe = function (dest) {
    var state = this._readableState;

    // if we're not piping anywhere, then do nothing.
    if (state.pipesCount === 0) return this;

    // just one destination.  most common case.
    if (state.pipesCount === 1) {
      // passed in one, but it's not the right one.
      if (dest && dest !== state.pipes) return this;

      if (!dest) dest = state.pipes;

      // got a match.
      state.pipes = null;
      state.pipesCount = 0;
      state.flowing = false;
      if (dest) dest.emit('unpipe', this);
      return this;
    }

    // slow case. multiple pipe destinations.

    if (!dest) {
      // remove all.
      var dests = state.pipes;
      var len = state.pipesCount;
      state.pipes = null;
      state.pipesCount = 0;
      state.flowing = false;

      for (var _i = 0; _i < len; _i++) {
        dests[_i].emit('unpipe', this);
      }return this;
    }

    // try to find the right one.
    var i = indexOf(state.pipes, dest);
    if (i === -1) return this;

    state.pipes.splice(i, 1);
    state.pipesCount -= 1;
    if (state.pipesCount === 1) state.pipes = state.pipes[0];

    dest.emit('unpipe', this);

    return this;
  };

  // set up data events if they are asked for
  // Ensure readable listeners eventually get something
  Readable.prototype.on = function (ev, fn) {
    var res = EventEmitter.prototype.on.call(this, ev, fn);

    if (ev === 'data') {
      // Start flowing on next tick if stream isn't explicitly paused
      if (this._readableState.flowing !== false) this.resume();
    } else if (ev === 'readable') {
      var state = this._readableState;
      if (!state.endEmitted && !state.readableListening) {
        state.readableListening = state.needReadable = true;
        state.emittedReadable = false;
        if (!state.reading) {
          nextTick(nReadingNextTick, this);
        } else if (state.length) {
          emitReadable(this);
        }
      }
    }

    return res;
  };
  Readable.prototype.addListener = Readable.prototype.on;

  function nReadingNextTick(self) {
    debug('readable nexttick read 0');
    self.read(0);
  }

  // pause() and resume() are remnants of the legacy readable stream API
  // If the user uses them, then switch into old mode.
  Readable.prototype.resume = function () {
    var state = this._readableState;
    if (!state.flowing) {
      debug('resume');
      state.flowing = true;
      resume(this, state);
    }
    return this;
  };

  function resume(stream, state) {
    if (!state.resumeScheduled) {
      state.resumeScheduled = true;
      nextTick(resume_, stream, state);
    }
  }

  function resume_(stream, state) {
    if (!state.reading) {
      debug('resume read 0');
      stream.read(0);
    }

    state.resumeScheduled = false;
    state.awaitDrain = 0;
    stream.emit('resume');
    flow(stream);
    if (state.flowing && !state.reading) stream.read(0);
  }

  Readable.prototype.pause = function () {
    debug('call pause flowing=%j', this._readableState.flowing);
    if (false !== this._readableState.flowing) {
      debug('pause');
      this._readableState.flowing = false;
      this.emit('pause');
    }
    return this;
  };

  function flow(stream) {
    var state = stream._readableState;
    debug('flow', state.flowing);
    while (state.flowing && stream.read() !== null) {}
  }

  // wrap an old-style stream as the async data source.
  // This is *not* part of the readable stream interface.
  // It is an ugly unfortunate mess of history.
  Readable.prototype.wrap = function (stream) {
    var state = this._readableState;
    var paused = false;

    var self = this;
    stream.on('end', function () {
      debug('wrapped end');
      if (state.decoder && !state.ended) {
        var chunk = state.decoder.end();
        if (chunk && chunk.length) self.push(chunk);
      }

      self.push(null);
    });

    stream.on('data', function (chunk) {
      debug('wrapped data');
      if (state.decoder) chunk = state.decoder.write(chunk);

      // don't skip over falsy values in objectMode
      if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

      var ret = self.push(chunk);
      if (!ret) {
        paused = true;
        stream.pause();
      }
    });

    // proxy all the other methods.
    // important when wrapping filters and duplexes.
    for (var i in stream) {
      if (this[i] === undefined && typeof stream[i] === 'function') {
        this[i] = function (method) {
          return function () {
            return stream[method].apply(stream, arguments);
          };
        }(i);
      }
    }

    // proxy certain important events.
    var events = ['error', 'close', 'destroy', 'pause', 'resume'];
    forEach(events, function (ev) {
      stream.on(ev, self.emit.bind(self, ev));
    });

    // when we try to consume some more bytes, simply unpause the
    // underlying stream.
    self._read = function (n) {
      debug('wrapped _read', n);
      if (paused) {
        paused = false;
        stream.resume();
      }
    };

    return self;
  };

  // exposed for testing purposes only.
  Readable._fromList = fromList;

  // Pluck off n bytes from an array of buffers.
  // Length is the combined lengths of all the buffers in the list.
  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function fromList(n, state) {
    // nothing buffered
    if (state.length === 0) return null;

    var ret;
    if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
      // read it all, truncate the list
      if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
      state.buffer.clear();
    } else {
      // read part of list
      ret = fromListPartial(n, state.buffer, state.decoder);
    }

    return ret;
  }

  // Extracts only enough buffered data to satisfy the amount requested.
  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function fromListPartial(n, list, hasStrings) {
    var ret;
    if (n < list.head.data.length) {
      // slice is the same for buffers and strings
      ret = list.head.data.slice(0, n);
      list.head.data = list.head.data.slice(n);
    } else if (n === list.head.data.length) {
      // first chunk is a perfect match
      ret = list.shift();
    } else {
      // result spans more than one buffer
      ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
    }
    return ret;
  }

  // Copies a specified amount of characters from the list of buffered data
  // chunks.
  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function copyFromBufferString(n, list) {
    var p = list.head;
    var c = 1;
    var ret = p.data;
    n -= ret.length;
    while (p = p.next) {
      var str = p.data;
      var nb = n > str.length ? str.length : n;
      if (nb === str.length) ret += str;else ret += str.slice(0, n);
      n -= nb;
      if (n === 0) {
        if (nb === str.length) {
          ++c;
          if (p.next) list.head = p.next;else list.head = list.tail = null;
        } else {
          list.head = p;
          p.data = str.slice(nb);
        }
        break;
      }
      ++c;
    }
    list.length -= c;
    return ret;
  }

  // Copies a specified amount of bytes from the list of buffered data chunks.
  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function copyFromBuffer(n, list) {
    var ret = Buffer.allocUnsafe(n);
    var p = list.head;
    var c = 1;
    p.data.copy(ret);
    n -= p.data.length;
    while (p = p.next) {
      var buf = p.data;
      var nb = n > buf.length ? buf.length : n;
      buf.copy(ret, ret.length - n, 0, nb);
      n -= nb;
      if (n === 0) {
        if (nb === buf.length) {
          ++c;
          if (p.next) list.head = p.next;else list.head = list.tail = null;
        } else {
          list.head = p;
          p.data = buf.slice(nb);
        }
        break;
      }
      ++c;
    }
    list.length -= c;
    return ret;
  }

  function endReadable(stream) {
    var state = stream._readableState;

    // If we get here before consuming all the bytes, then that is a
    // bug in node.  Should never happen.
    if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

    if (!state.endEmitted) {
      state.ended = true;
      nextTick(endReadableNT, state, stream);
    }
  }

  function endReadableNT(state, stream) {
    // Check that we didn't get one last unshift.
    if (!state.endEmitted && state.length === 0) {
      state.endEmitted = true;
      stream.readable = false;
      stream.emit('end');
    }
  }

  function forEach(xs, f) {
    for (var i = 0, l = xs.length; i < l; i++) {
      f(xs[i], i);
    }
  }

  function indexOf(xs, x) {
    for (var i = 0, l = xs.length; i < l; i++) {
      if (xs[i] === x) return i;
    }
    return -1;
  }

  // A bit simpler than readable streams.
  // Implement an async ._write(chunk, encoding, cb), and it'll handle all
  // the drain event emission and buffering.

  Writable.WritableState = WritableState;
  inherits(Writable, EventEmitter);

  function nop() {}

  function WriteReq(chunk, encoding, cb) {
    this.chunk = chunk;
    this.encoding = encoding;
    this.callback = cb;
    this.next = null;
  }

  function WritableState(options, stream) {
    Object.defineProperty(this, 'buffer', {
      get: deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.')
    });
    options = options || {};

    // object stream flag to indicate whether or not this stream
    // contains buffers or objects.
    this.objectMode = !!options.objectMode;

    if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

    // the point at which write() starts returning false
    // Note: 0 is a valid value, means that we always return false if
    // the entire buffer is not flushed immediately on write()
    var hwm = options.highWaterMark;
    var defaultHwm = this.objectMode ? 16 : 16 * 1024;
    this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

    // cast to ints.
    this.highWaterMark = ~ ~this.highWaterMark;

    this.needDrain = false;
    // at the start of calling end()
    this.ending = false;
    // when end() has been called, and returned
    this.ended = false;
    // when 'finish' is emitted
    this.finished = false;

    // should we decode strings into buffers before passing to _write?
    // this is here so that some node-core streams can optimize string
    // handling at a lower level.
    var noDecode = options.decodeStrings === false;
    this.decodeStrings = !noDecode;

    // Crypto is kind of old and crusty.  Historically, its default string
    // encoding is 'binary' so we have to make this configurable.
    // Everything else in the universe uses 'utf8', though.
    this.defaultEncoding = options.defaultEncoding || 'utf8';

    // not an actual buffer we keep track of, but a measurement
    // of how much we're waiting to get pushed to some underlying
    // socket or file.
    this.length = 0;

    // a flag to see when we're in the middle of a write.
    this.writing = false;

    // when true all writes will be buffered until .uncork() call
    this.corked = 0;

    // a flag to be able to tell if the onwrite cb is called immediately,
    // or on a later tick.  We set this to true at first, because any
    // actions that shouldn't happen until "later" should generally also
    // not happen before the first write call.
    this.sync = true;

    // a flag to know if we're processing previously buffered items, which
    // may call the _write() callback in the same tick, so that we don't
    // end up in an overlapped onwrite situation.
    this.bufferProcessing = false;

    // the callback that's passed to _write(chunk,cb)
    this.onwrite = function (er) {
      onwrite(stream, er);
    };

    // the callback that the user supplies to write(chunk,encoding,cb)
    this.writecb = null;

    // the amount that is being written when _write is called.
    this.writelen = 0;

    this.bufferedRequest = null;
    this.lastBufferedRequest = null;

    // number of pending user-supplied write callbacks
    // this must be 0 before 'finish' can be emitted
    this.pendingcb = 0;

    // emit prefinish if the only thing we're waiting for is _write cbs
    // This is relevant for synchronous Transform streams
    this.prefinished = false;

    // True if the error was already emitted and should not be thrown again
    this.errorEmitted = false;

    // count buffered requests
    this.bufferedRequestCount = 0;

    // allocate the first CorkedRequest, there is always
    // one allocated and free to use, and we maintain at most two
    this.corkedRequestsFree = new CorkedRequest(this);
  }

  WritableState.prototype.getBuffer = function writableStateGetBuffer() {
    var current = this.bufferedRequest;
    var out = [];
    while (current) {
      out.push(current);
      current = current.next;
    }
    return out;
  };
  function Writable(options) {

    // Writable ctor is applied to Duplexes, though they're not
    // instanceof Writable, they're instanceof Readable.
    if (!(this instanceof Writable) && !(this instanceof Duplex)) return new Writable(options);

    this._writableState = new WritableState(options, this);

    // legacy.
    this.writable = true;

    if (options) {
      if (typeof options.write === 'function') this._write = options.write;

      if (typeof options.writev === 'function') this._writev = options.writev;
    }

    EventEmitter.call(this);
  }

  // Otherwise people can pipe Writable streams, which is just wrong.
  Writable.prototype.pipe = function () {
    this.emit('error', new Error('Cannot pipe, not readable'));
  };

  function writeAfterEnd(stream, cb) {
    var er = new Error('write after end');
    // TODO: defer error events consistently everywhere, not just the cb
    stream.emit('error', er);
    nextTick(cb, er);
  }

  // If we get something that is not a buffer, string, null, or undefined,
  // and we're not in objectMode, then that's an error.
  // Otherwise stream chunks are all considered to be of length=1, and the
  // watermarks determine how many objects to keep in the buffer, rather than
  // how many bytes or characters.
  function validChunk(stream, state, chunk, cb) {
    var valid = true;
    var er = false;
    // Always throw error if a null is written
    // if we are not in object mode then throw
    // if it is not a buffer, string, or undefined.
    if (chunk === null) {
      er = new TypeError('May not write null values to stream');
    } else if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
      er = new TypeError('Invalid non-string/buffer chunk');
    }
    if (er) {
      stream.emit('error', er);
      nextTick(cb, er);
      valid = false;
    }
    return valid;
  }

  Writable.prototype.write = function (chunk, encoding, cb) {
    var state = this._writableState;
    var ret = false;

    if (typeof encoding === 'function') {
      cb = encoding;
      encoding = null;
    }

    if (Buffer.isBuffer(chunk)) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

    if (typeof cb !== 'function') cb = nop;

    if (state.ended) writeAfterEnd(this, cb);else if (validChunk(this, state, chunk, cb)) {
      state.pendingcb++;
      ret = writeOrBuffer(this, state, chunk, encoding, cb);
    }

    return ret;
  };

  Writable.prototype.cork = function () {
    var state = this._writableState;

    state.corked++;
  };

  Writable.prototype.uncork = function () {
    var state = this._writableState;

    if (state.corked) {
      state.corked--;

      if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
    }
  };

  Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
    // node::ParseEncoding() requires lower case.
    if (typeof encoding === 'string') encoding = encoding.toLowerCase();
    if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
    this._writableState.defaultEncoding = encoding;
    return this;
  };

  function decodeChunk(state, chunk, encoding) {
    if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
      chunk = Buffer.from(chunk, encoding);
    }
    return chunk;
  }

  // if we're already writing something, then just put this
  // in the queue, and wait our turn.  Otherwise, call _write
  // If we return false, then we need a drain event, so set that flag.
  function writeOrBuffer(stream, state, chunk, encoding, cb) {
    chunk = decodeChunk(state, chunk, encoding);

    if (Buffer.isBuffer(chunk)) encoding = 'buffer';
    var len = state.objectMode ? 1 : chunk.length;

    state.length += len;

    var ret = state.length < state.highWaterMark;
    // we must ensure that previous needDrain will not be reset to false.
    if (!ret) state.needDrain = true;

    if (state.writing || state.corked) {
      var last = state.lastBufferedRequest;
      state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
      if (last) {
        last.next = state.lastBufferedRequest;
      } else {
        state.bufferedRequest = state.lastBufferedRequest;
      }
      state.bufferedRequestCount += 1;
    } else {
      doWrite(stream, state, false, len, chunk, encoding, cb);
    }

    return ret;
  }

  function doWrite(stream, state, writev, len, chunk, encoding, cb) {
    state.writelen = len;
    state.writecb = cb;
    state.writing = true;
    state.sync = true;
    if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
    state.sync = false;
  }

  function onwriteError(stream, state, sync, er, cb) {
    --state.pendingcb;
    if (sync) nextTick(cb, er);else cb(er);

    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
  }

  function onwriteStateUpdate(state) {
    state.writing = false;
    state.writecb = null;
    state.length -= state.writelen;
    state.writelen = 0;
  }

  function onwrite(stream, er) {
    var state = stream._writableState;
    var sync = state.sync;
    var cb = state.writecb;

    onwriteStateUpdate(state);

    if (er) onwriteError(stream, state, sync, er, cb);else {
      // Check if we're actually ready to finish, but don't emit yet
      var finished = needFinish(state);

      if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
        clearBuffer(stream, state);
      }

      if (sync) {
        /*<replacement>*/
          nextTick(afterWrite, stream, state, finished, cb);
        /*</replacement>*/
      } else {
          afterWrite(stream, state, finished, cb);
        }
    }
  }

  function afterWrite(stream, state, finished, cb) {
    if (!finished) onwriteDrain(stream, state);
    state.pendingcb--;
    cb();
    finishMaybe(stream, state);
  }

  // Must force callback to be called on nextTick, so that we don't
  // emit 'drain' before the write() consumer gets the 'false' return
  // value, and has a chance to attach a 'drain' listener.
  function onwriteDrain(stream, state) {
    if (state.length === 0 && state.needDrain) {
      state.needDrain = false;
      stream.emit('drain');
    }
  }

  // if there's something in the buffer waiting, then process it
  function clearBuffer(stream, state) {
    state.bufferProcessing = true;
    var entry = state.bufferedRequest;

    if (stream._writev && entry && entry.next) {
      // Fast case, write everything using _writev()
      var l = state.bufferedRequestCount;
      var buffer = new Array(l);
      var holder = state.corkedRequestsFree;
      holder.entry = entry;

      var count = 0;
      while (entry) {
        buffer[count] = entry;
        entry = entry.next;
        count += 1;
      }

      doWrite(stream, state, true, state.length, buffer, '', holder.finish);

      // doWrite is almost always async, defer these to save a bit of time
      // as the hot path ends with doWrite
      state.pendingcb++;
      state.lastBufferedRequest = null;
      if (holder.next) {
        state.corkedRequestsFree = holder.next;
        holder.next = null;
      } else {
        state.corkedRequestsFree = new CorkedRequest(state);
      }
    } else {
      // Slow case, write chunks one-by-one
      while (entry) {
        var chunk = entry.chunk;
        var encoding = entry.encoding;
        var cb = entry.callback;
        var len = state.objectMode ? 1 : chunk.length;

        doWrite(stream, state, false, len, chunk, encoding, cb);
        entry = entry.next;
        // if we didn't call the onwrite immediately, then
        // it means that we need to wait until it does.
        // also, that means that the chunk and cb are currently
        // being processed, so move the buffer counter past them.
        if (state.writing) {
          break;
        }
      }

      if (entry === null) state.lastBufferedRequest = null;
    }

    state.bufferedRequestCount = 0;
    state.bufferedRequest = entry;
    state.bufferProcessing = false;
  }

  Writable.prototype._write = function (chunk, encoding, cb) {
    cb(new Error('not implemented'));
  };

  Writable.prototype._writev = null;

  Writable.prototype.end = function (chunk, encoding, cb) {
    var state = this._writableState;

    if (typeof chunk === 'function') {
      cb = chunk;
      chunk = null;
      encoding = null;
    } else if (typeof encoding === 'function') {
      cb = encoding;
      encoding = null;
    }

    if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

    // .end() fully uncorks
    if (state.corked) {
      state.corked = 1;
      this.uncork();
    }

    // ignore unnecessary end() calls.
    if (!state.ending && !state.finished) endWritable(this, state, cb);
  };

  function needFinish(state) {
    return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
  }

  function prefinish(stream, state) {
    if (!state.prefinished) {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }

  function finishMaybe(stream, state) {
    var need = needFinish(state);
    if (need) {
      if (state.pendingcb === 0) {
        prefinish(stream, state);
        state.finished = true;
        stream.emit('finish');
      } else {
        prefinish(stream, state);
      }
    }
    return need;
  }

  function endWritable(stream, state, cb) {
    state.ending = true;
    finishMaybe(stream, state);
    if (cb) {
      if (state.finished) nextTick(cb);else stream.once('finish', cb);
    }
    state.ended = true;
    stream.writable = false;
  }

  // It seems a linked list but it is not
  // there will be only 2 of these for each stream
  function CorkedRequest(state) {
    var _this = this;

    this.next = null;
    this.entry = null;

    this.finish = function (err) {
      var entry = _this.entry;
      _this.entry = null;
      while (entry) {
        var cb = entry.callback;
        state.pendingcb--;
        cb(err);
        entry = entry.next;
      }
      if (state.corkedRequestsFree) {
        state.corkedRequestsFree.next = _this;
      } else {
        state.corkedRequestsFree = _this;
      }
    };
  }

  inherits(Duplex, Readable);

  var keys = Object.keys(Writable.prototype);
  for (var v = 0; v < keys.length; v++) {
    var method = keys[v];
    if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
  }
  function Duplex(options) {
    if (!(this instanceof Duplex)) return new Duplex(options);

    Readable.call(this, options);
    Writable.call(this, options);

    if (options && options.readable === false) this.readable = false;

    if (options && options.writable === false) this.writable = false;

    this.allowHalfOpen = true;
    if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

    this.once('end', onend);
  }

  // the no-half-open enforcer
  function onend() {
    // if we allow half-open state, or if the writable side ended,
    // then we're ok.
    if (this.allowHalfOpen || this._writableState.ended) return;

    // no more data can be written.
    // But allow more writes to happen in this tick.
    nextTick(onEndNT, this);
  }

  function onEndNT(self) {
    self.end();
  }

  // a transform stream is a readable/writable stream where you do
  // something with the data.  Sometimes it's called a "filter",
  // but that's not a great name for it, since that implies a thing where
  // some bits pass through, and others are simply ignored.  (That would
  // be a valid example of a transform, of course.)
  //
  // While the output is causally related to the input, it's not a
  // necessarily symmetric or synchronous transformation.  For example,
  // a zlib stream might take multiple plain-text writes(), and then
  // emit a single compressed chunk some time in the future.
  //
  // Here's how this works:
  //
  // The Transform stream has all the aspects of the readable and writable
  // stream classes.  When you write(chunk), that calls _write(chunk,cb)
  // internally, and returns false if there's a lot of pending writes
  // buffered up.  When you call read(), that calls _read(n) until
  // there's enough pending readable data buffered up.
  //
  // In a transform stream, the written data is placed in a buffer.  When
  // _read(n) is called, it transforms the queued up data, calling the
  // buffered _write cb's as it consumes chunks.  If consuming a single
  // written chunk would result in multiple output chunks, then the first
  // outputted bit calls the readcb, and subsequent chunks just go into
  // the read buffer, and will cause it to emit 'readable' if necessary.
  //
  // This way, back-pressure is actually determined by the reading side,
  // since _read has to be called to start processing a new chunk.  However,
  // a pathological inflate type of transform can cause excessive buffering
  // here.  For example, imagine a stream where every byte of input is
  // interpreted as an integer from 0-255, and then results in that many
  // bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
  // 1kb of data being output.  In this case, you could write a very small
  // amount of input, and end up with a very large amount of output.  In
  // such a pathological inflating mechanism, there'd be no way to tell
  // the system to stop doing the transform.  A single 4MB write could
  // cause the system to run out of memory.
  //
  // However, even in such a pathological case, only a single written chunk
  // would be consumed, and then the rest would wait (un-transformed) until
  // the results of the previous transformed chunk were consumed.

  inherits(Transform, Duplex);

  function TransformState(stream) {
    this.afterTransform = function (er, data) {
      return afterTransform(stream, er, data);
    };

    this.needTransform = false;
    this.transforming = false;
    this.writecb = null;
    this.writechunk = null;
    this.writeencoding = null;
  }

  function afterTransform(stream, er, data) {
    var ts = stream._transformState;
    ts.transforming = false;

    var cb = ts.writecb;

    if (!cb) return stream.emit('error', new Error('no writecb in Transform class'));

    ts.writechunk = null;
    ts.writecb = null;

    if (data !== null && data !== undefined) stream.push(data);

    cb(er);

    var rs = stream._readableState;
    rs.reading = false;
    if (rs.needReadable || rs.length < rs.highWaterMark) {
      stream._read(rs.highWaterMark);
    }
  }
  function Transform(options) {
    if (!(this instanceof Transform)) return new Transform(options);

    Duplex.call(this, options);

    this._transformState = new TransformState(this);

    // when the writable side finishes, then flush out anything remaining.
    var stream = this;

    // start out asking for a readable event once data is transformed.
    this._readableState.needReadable = true;

    // we have implemented the _read method, and done the other things
    // that Readable wants before the first _read call, so unset the
    // sync guard flag.
    this._readableState.sync = false;

    if (options) {
      if (typeof options.transform === 'function') this._transform = options.transform;

      if (typeof options.flush === 'function') this._flush = options.flush;
    }

    this.once('prefinish', function () {
      if (typeof this._flush === 'function') this._flush(function (er) {
        done(stream, er);
      });else done(stream);
    });
  }

  Transform.prototype.push = function (chunk, encoding) {
    this._transformState.needTransform = false;
    return Duplex.prototype.push.call(this, chunk, encoding);
  };

  // This is the part where you do stuff!
  // override this function in implementation classes.
  // 'chunk' is an input chunk.
  //
  // Call `push(newChunk)` to pass along transformed output
  // to the readable side.  You may call 'push' zero or more times.
  //
  // Call `cb(err)` when you are done with this chunk.  If you pass
  // an error, then that'll put the hurt on the whole operation.  If you
  // never call cb(), then you'll never get another chunk.
  Transform.prototype._transform = function (chunk, encoding, cb) {
    throw new Error('Not implemented');
  };

  Transform.prototype._write = function (chunk, encoding, cb) {
    var ts = this._transformState;
    ts.writecb = cb;
    ts.writechunk = chunk;
    ts.writeencoding = encoding;
    if (!ts.transforming) {
      var rs = this._readableState;
      if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
    }
  };

  // Doesn't matter what the args are here.
  // _transform does all the work.
  // That we got here means that the readable side wants more data.
  Transform.prototype._read = function (n) {
    var ts = this._transformState;

    if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
      ts.transforming = true;
      this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
    } else {
      // mark that we need a transform, so that any data that comes in
      // will get processed, now that we've asked for it.
      ts.needTransform = true;
    }
  };

  function done(stream, er) {
    if (er) return stream.emit('error', er);

    // if there's nothing in the write buffer, then that means
    // that nothing more will ever be provided
    var ws = stream._writableState;
    var ts = stream._transformState;

    if (ws.length) throw new Error('Calling transform done when ws.length != 0');

    if (ts.transforming) throw new Error('Calling transform done when still transforming');

    return stream.push(null);
  }

  inherits(PassThrough, Transform);
  function PassThrough(options) {
    if (!(this instanceof PassThrough)) return new PassThrough(options);

    Transform.call(this, options);
  }

  PassThrough.prototype._transform = function (chunk, encoding, cb) {
    cb(null, chunk);
  };

  inherits(Stream, EventEmitter);
  Stream.Readable = Readable;
  Stream.Writable = Writable;
  Stream.Duplex = Duplex;
  Stream.Transform = Transform;
  Stream.PassThrough = PassThrough;

  // Backwards-compat with node 0.4.x
  Stream.Stream = Stream;

  // old-style streams.  Note that the pipe method (the only relevant
  // part of this class) is overridden in the Readable class.

  function Stream() {
    EventEmitter.call(this);
  }

  Stream.prototype.pipe = function(dest, options) {
    var source = this;

    function ondata(chunk) {
      if (dest.writable) {
        if (false === dest.write(chunk) && source.pause) {
          source.pause();
        }
      }
    }

    source.on('data', ondata);

    function ondrain() {
      if (source.readable && source.resume) {
        source.resume();
      }
    }

    dest.on('drain', ondrain);

    // If the 'end' option is not supplied, dest.end() will be called when
    // source gets the 'end' or 'close' events.  Only dest.end() once.
    if (!dest._isStdio && (!options || options.end !== false)) {
      source.on('end', onend);
      source.on('close', onclose);
    }

    var didOnEnd = false;
    function onend() {
      if (didOnEnd) return;
      didOnEnd = true;

      dest.end();
    }


    function onclose() {
      if (didOnEnd) return;
      didOnEnd = true;

      if (typeof dest.destroy === 'function') dest.destroy();
    }

    // don't leave dangling pipes when there are errors.
    function onerror(er) {
      cleanup();
      if (EventEmitter.listenerCount(this, 'error') === 0) {
        throw er; // Unhandled stream error in pipe.
      }
    }

    source.on('error', onerror);
    dest.on('error', onerror);

    // remove all the event listeners that were added.
    function cleanup() {
      source.removeListener('data', ondata);
      dest.removeListener('drain', ondrain);

      source.removeListener('end', onend);
      source.removeListener('close', onclose);

      source.removeListener('error', onerror);
      dest.removeListener('error', onerror);

      source.removeListener('end', cleanup);
      source.removeListener('close', cleanup);

      dest.removeListener('close', cleanup);
    }

    source.on('end', cleanup);
    source.on('close', cleanup);

    dest.on('close', cleanup);

    dest.emit('pipe', source);

    // Allow for unix-like usage: A.pipe(B).pipe(C)
    return dest;
  };

  var _polyfillNode_stream = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Duplex: Duplex,
    PassThrough: PassThrough,
    Readable: Readable,
    Stream: Stream,
    Transform: Transform,
    Writable: Writable,
    default: Stream
  });

  var require$$1 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_stream);

  var parserAsync = {exports: {}};

  var msg = {
    2:      'need dictionary',     /* Z_NEED_DICT       2  */
    1:      'stream end',          /* Z_STREAM_END      1  */
    0:      '',                    /* Z_OK              0  */
    '-1':   'file error',          /* Z_ERRNO         (-1) */
    '-2':   'stream error',        /* Z_STREAM_ERROR  (-2) */
    '-3':   'data error',          /* Z_DATA_ERROR    (-3) */
    '-4':   'insufficient memory', /* Z_MEM_ERROR     (-4) */
    '-5':   'buffer error',        /* Z_BUF_ERROR     (-5) */
    '-6':   'incompatible version' /* Z_VERSION_ERROR (-6) */
  };

  function ZStream() {
    /* next input byte */
    this.input = null; // JS specific, because we have no pointers
    this.next_in = 0;
    /* number of bytes available at input */
    this.avail_in = 0;
    /* total number of input bytes read so far */
    this.total_in = 0;
    /* next output byte should be put there */
    this.output = null; // JS specific, because we have no pointers
    this.next_out = 0;
    /* remaining free space at output */
    this.avail_out = 0;
    /* total number of bytes output so far */
    this.total_out = 0;
    /* last error message, NULL if no error */
    this.msg = ''/*Z_NULL*/;
    /* not visible by applications */
    this.state = null;
    /* best guess about the data type: binary or text */
    this.data_type = 2/*Z_UNKNOWN*/;
    /* adler32 value of the uncompressed data */
    this.adler = 0;
  }

  function arraySet(dest, src, src_offs, len, dest_offs) {
    if (src.subarray && dest.subarray) {
      dest.set(src.subarray(src_offs, src_offs + len), dest_offs);
      return;
    }
    // Fallback to ordinary array
    for (var i = 0; i < len; i++) {
      dest[dest_offs + i] = src[src_offs + i];
    }
  }


  var Buf8 = Uint8Array;
  var Buf16 = Uint16Array;
  var Buf32 = Int32Array;
  // Enable/Disable typed arrays use, for testing
  //

  /* Public constants ==========================================================*/
  /* ===========================================================================*/


  //var Z_FILTERED          = 1;
  //var Z_HUFFMAN_ONLY      = 2;
  //var Z_RLE               = 3;
  var Z_FIXED$2 = 4;
  //var Z_DEFAULT_STRATEGY  = 0;

  /* Possible values of the data_type field (though see inflate()) */
  var Z_BINARY$1 = 0;
  var Z_TEXT$1 = 1;
  //var Z_ASCII             = 1; // = Z_TEXT
  var Z_UNKNOWN$2 = 2;

  /*============================================================================*/


  function zero$1(buf) {
    var len = buf.length;
    while (--len >= 0) {
      buf[len] = 0;
    }
  }

  // From zutil.h

  var STORED_BLOCK = 0;
  var STATIC_TREES = 1;
  var DYN_TREES = 2;
  /* The three kinds of block type */

  var MIN_MATCH$1 = 3;
  var MAX_MATCH$1 = 258;
  /* The minimum and maximum match lengths */

  // From deflate.h
  /* ===========================================================================
   * Internal compression state.
   */

  var LENGTH_CODES$1 = 29;
  /* number of length codes, not counting the special END_BLOCK code */

  var LITERALS$1 = 256;
  /* number of literal bytes 0..255 */

  var L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1;
  /* number of Literal or Length codes, including the END_BLOCK code */

  var D_CODES$1 = 30;
  /* number of distance codes */

  var BL_CODES$1 = 19;
  /* number of codes used to transfer the bit lengths */

  var HEAP_SIZE$1 = 2 * L_CODES$1 + 1;
  /* maximum heap size */

  var MAX_BITS$1 = 15;
  /* All codes must not exceed MAX_BITS bits */

  var Buf_size = 16;
  /* size of bit buffer in bi_buf */


  /* ===========================================================================
   * Constants
   */

  var MAX_BL_BITS = 7;
  /* Bit length codes must not exceed MAX_BL_BITS bits */

  var END_BLOCK = 256;
  /* end of block literal code */

  var REP_3_6 = 16;
  /* repeat previous bit length 3-6 times (2 bits of repeat count) */

  var REPZ_3_10 = 17;
  /* repeat a zero length 3-10 times  (3 bits of repeat count) */

  var REPZ_11_138 = 18;
  /* repeat a zero length 11-138 times  (7 bits of repeat count) */

  /* eslint-disable comma-spacing,array-bracket-spacing */
  var extra_lbits = /* extra bits for each length code */ [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];

  var extra_dbits = /* extra bits for each distance code */ [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

  var extra_blbits = /* extra bits for each bit length code */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7];

  var bl_order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  /* eslint-enable comma-spacing,array-bracket-spacing */

  /* The lengths of the bit length codes are sent in order of decreasing
   * probability, to avoid transmitting the lengths for unused bit length codes.
   */

  /* ===========================================================================
   * Local data. These are initialized only once.
   */

  // We pre-fill arrays with 0 to avoid uninitialized gaps

  var DIST_CODE_LEN = 512; /* see definition of array dist_code below */

  // !!!! Use flat array insdead of structure, Freq = i*2, Len = i*2+1
  var static_ltree = new Array((L_CODES$1 + 2) * 2);
  zero$1(static_ltree);
  /* The static literal tree. Since the bit lengths are imposed, there is no
   * need for the L_CODES extra codes used during heap construction. However
   * The codes 286 and 287 are needed to build a canonical tree (see _tr_init
   * below).
   */

  var static_dtree = new Array(D_CODES$1 * 2);
  zero$1(static_dtree);
  /* The static distance tree. (Actually a trivial tree since all codes use
   * 5 bits.)
   */

  var _dist_code = new Array(DIST_CODE_LEN);
  zero$1(_dist_code);
  /* Distance codes. The first 256 values correspond to the distances
   * 3 .. 258, the last 256 values correspond to the top 8 bits of
   * the 15 bit distances.
   */

  var _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
  zero$1(_length_code);
  /* length code for each normalized match length (0 == MIN_MATCH) */

  var base_length = new Array(LENGTH_CODES$1);
  zero$1(base_length);
  /* First normalized length for each code (0 = MIN_MATCH) */

  var base_dist = new Array(D_CODES$1);
  zero$1(base_dist);
  /* First normalized distance for each code (0 = distance of 1) */


  function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {

    this.static_tree = static_tree; /* static tree or NULL */
    this.extra_bits = extra_bits; /* extra bits for each code or NULL */
    this.extra_base = extra_base; /* base index for extra_bits */
    this.elems = elems; /* max number of elements in the tree */
    this.max_length = max_length; /* max bit length for the codes */

    // show if `static_tree` has data or dummy - needed for monomorphic objects
    this.has_stree = static_tree && static_tree.length;
  }


  var static_l_desc;
  var static_d_desc;
  var static_bl_desc;


  function TreeDesc(dyn_tree, stat_desc) {
    this.dyn_tree = dyn_tree; /* the dynamic tree */
    this.max_code = 0; /* largest code with non zero frequency */
    this.stat_desc = stat_desc; /* the corresponding static tree */
  }



  function d_code(dist) {
    return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
  }


  /* ===========================================================================
   * Output a short LSB first on the stream.
   * IN assertion: there is enough room in pendingBuf.
   */
  function put_short(s, w) {
    //    put_byte(s, (uch)((w) & 0xff));
    //    put_byte(s, (uch)((ush)(w) >> 8));
    s.pending_buf[s.pending++] = (w) & 0xff;
    s.pending_buf[s.pending++] = (w >>> 8) & 0xff;
  }


  /* ===========================================================================
   * Send a value on a given number of bits.
   * IN assertion: length <= 16 and value fits in length bits.
   */
  function send_bits(s, value, length) {
    if (s.bi_valid > (Buf_size - length)) {
      s.bi_buf |= (value << s.bi_valid) & 0xffff;
      put_short(s, s.bi_buf);
      s.bi_buf = value >> (Buf_size - s.bi_valid);
      s.bi_valid += length - Buf_size;
    } else {
      s.bi_buf |= (value << s.bi_valid) & 0xffff;
      s.bi_valid += length;
    }
  }


  function send_code(s, c, tree) {
    send_bits(s, tree[c * 2] /*.Code*/ , tree[c * 2 + 1] /*.Len*/ );
  }


  /* ===========================================================================
   * Reverse the first len bits of a code, using straightforward code (a faster
   * method would use a table)
   * IN assertion: 1 <= len <= 15
   */
  function bi_reverse(code, len) {
    var res = 0;
    do {
      res |= code & 1;
      code >>>= 1;
      res <<= 1;
    } while (--len > 0);
    return res >>> 1;
  }


  /* ===========================================================================
   * Flush the bit buffer, keeping at most 7 bits in it.
   */
  function bi_flush(s) {
    if (s.bi_valid === 16) {
      put_short(s, s.bi_buf);
      s.bi_buf = 0;
      s.bi_valid = 0;

    } else if (s.bi_valid >= 8) {
      s.pending_buf[s.pending++] = s.bi_buf & 0xff;
      s.bi_buf >>= 8;
      s.bi_valid -= 8;
    }
  }


  /* ===========================================================================
   * Compute the optimal bit lengths for a tree and update the total bit length
   * for the current block.
   * IN assertion: the fields freq and dad are set, heap[heap_max] and
   *    above are the tree nodes sorted by increasing frequency.
   * OUT assertions: the field len is set to the optimal bit length, the
   *     array bl_count contains the frequencies for each bit length.
   *     The length opt_len is updated; static_len is also updated if stree is
   *     not null.
   */
  function gen_bitlen(s, desc) {
  //    deflate_state *s;
  //    tree_desc *desc;    /* the tree descriptor */
    var tree = desc.dyn_tree;
    var max_code = desc.max_code;
    var stree = desc.stat_desc.static_tree;
    var has_stree = desc.stat_desc.has_stree;
    var extra = desc.stat_desc.extra_bits;
    var base = desc.stat_desc.extra_base;
    var max_length = desc.stat_desc.max_length;
    var h; /* heap index */
    var n, m; /* iterate over the tree elements */
    var bits; /* bit length */
    var xbits; /* extra bits */
    var f; /* frequency */
    var overflow = 0; /* number of elements with bit length too large */

    for (bits = 0; bits <= MAX_BITS$1; bits++) {
      s.bl_count[bits] = 0;
    }

    /* In a first pass, compute the optimal bit lengths (which may
     * overflow in the case of the bit length tree).
     */
    tree[s.heap[s.heap_max] * 2 + 1] /*.Len*/ = 0; /* root of the heap */

    for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
      n = s.heap[h];
      bits = tree[tree[n * 2 + 1] /*.Dad*/ * 2 + 1] /*.Len*/ + 1;
      if (bits > max_length) {
        bits = max_length;
        overflow++;
      }
      tree[n * 2 + 1] /*.Len*/ = bits;
      /* We overwrite tree[n].Dad which is no longer needed */

      if (n > max_code) {
        continue;
      } /* not a leaf node */

      s.bl_count[bits]++;
      xbits = 0;
      if (n >= base) {
        xbits = extra[n - base];
      }
      f = tree[n * 2] /*.Freq*/ ;
      s.opt_len += f * (bits + xbits);
      if (has_stree) {
        s.static_len += f * (stree[n * 2 + 1] /*.Len*/ + xbits);
      }
    }
    if (overflow === 0) {
      return;
    }

    // Trace((stderr,"\nbit length overflow\n"));
    /* This happens for example on obj2 and pic of the Calgary corpus */

    /* Find the first bit length which could increase: */
    do {
      bits = max_length - 1;
      while (s.bl_count[bits] === 0) {
        bits--;
      }
      s.bl_count[bits]--; /* move one leaf down the tree */
      s.bl_count[bits + 1] += 2; /* move one overflow item as its brother */
      s.bl_count[max_length]--;
      /* The brother of the overflow item also moves one step up,
       * but this does not affect bl_count[max_length]
       */
      overflow -= 2;
    } while (overflow > 0);

    /* Now recompute all bit lengths, scanning in increasing frequency.
     * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
     * lengths instead of fixing only the wrong ones. This idea is taken
     * from 'ar' written by Haruhiko Okumura.)
     */
    for (bits = max_length; bits !== 0; bits--) {
      n = s.bl_count[bits];
      while (n !== 0) {
        m = s.heap[--h];
        if (m > max_code) {
          continue;
        }
        if (tree[m * 2 + 1] /*.Len*/ !== bits) {
          // Trace((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
          s.opt_len += (bits - tree[m * 2 + 1] /*.Len*/ ) * tree[m * 2] /*.Freq*/ ;
          tree[m * 2 + 1] /*.Len*/ = bits;
        }
        n--;
      }
    }
  }


  /* ===========================================================================
   * Generate the codes for a given tree and bit counts (which need not be
   * optimal).
   * IN assertion: the array bl_count contains the bit length statistics for
   * the given tree and the field len is set for all tree elements.
   * OUT assertion: the field code is set for all tree elements of non
   *     zero code length.
   */
  function gen_codes(tree, max_code, bl_count) {
  //    ct_data *tree;             /* the tree to decorate */
  //    int max_code;              /* largest code with non zero frequency */
  //    ushf *bl_count;            /* number of codes at each bit length */

    var next_code = new Array(MAX_BITS$1 + 1); /* next code value for each bit length */
    var code = 0; /* running code value */
    var bits; /* bit index */
    var n; /* code index */

    /* The distribution counts are first used to generate the code values
     * without bit reversal.
     */
    for (bits = 1; bits <= MAX_BITS$1; bits++) {
      next_code[bits] = code = (code + bl_count[bits - 1]) << 1;
    }
    /* Check that the bit counts in bl_count are consistent. The last code
     * must be all ones.
     */
    //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
    //        "inconsistent bit counts");
    //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

    for (n = 0; n <= max_code; n++) {
      var len = tree[n * 2 + 1] /*.Len*/ ;
      if (len === 0) {
        continue;
      }
      /* Now reverse the bits */
      tree[n * 2] /*.Code*/ = bi_reverse(next_code[len]++, len);

      //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
      //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
    }
  }


  /* ===========================================================================
   * Initialize the various 'constant' tables.
   */
  function tr_static_init() {
    var n; /* iterates over tree elements */
    var bits; /* bit counter */
    var length; /* length value */
    var code; /* code value */
    var dist; /* distance index */
    var bl_count = new Array(MAX_BITS$1 + 1);
    /* number of codes at each bit length for an optimal tree */

    // do check in _tr_init()
    //if (static_init_done) return;

    /* For some embedded targets, global variables are not initialized: */
    /*#ifdef NO_INIT_GLOBAL_POINTERS
      static_l_desc.static_tree = static_ltree;
      static_l_desc.extra_bits = extra_lbits;
      static_d_desc.static_tree = static_dtree;
      static_d_desc.extra_bits = extra_dbits;
      static_bl_desc.extra_bits = extra_blbits;
    #endif*/

    /* Initialize the mapping length (0..255) -> length code (0..28) */
    length = 0;
    for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
      base_length[code] = length;
      for (n = 0; n < (1 << extra_lbits[code]); n++) {
        _length_code[length++] = code;
      }
    }
    //Assert (length == 256, "tr_static_init: length != 256");
    /* Note that the length 255 (match length 258) can be represented
     * in two different ways: code 284 + 5 bits or code 285, so we
     * overwrite length_code[255] to use the best encoding:
     */
    _length_code[length - 1] = code;

    /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
    dist = 0;
    for (code = 0; code < 16; code++) {
      base_dist[code] = dist;
      for (n = 0; n < (1 << extra_dbits[code]); n++) {
        _dist_code[dist++] = code;
      }
    }
    //Assert (dist == 256, "tr_static_init: dist != 256");
    dist >>= 7; /* from now on, all distances are divided by 128 */
    for (; code < D_CODES$1; code++) {
      base_dist[code] = dist << 7;
      for (n = 0; n < (1 << (extra_dbits[code] - 7)); n++) {
        _dist_code[256 + dist++] = code;
      }
    }
    //Assert (dist == 256, "tr_static_init: 256+dist != 512");

    /* Construct the codes of the static literal tree */
    for (bits = 0; bits <= MAX_BITS$1; bits++) {
      bl_count[bits] = 0;
    }

    n = 0;
    while (n <= 143) {
      static_ltree[n * 2 + 1] /*.Len*/ = 8;
      n++;
      bl_count[8]++;
    }
    while (n <= 255) {
      static_ltree[n * 2 + 1] /*.Len*/ = 9;
      n++;
      bl_count[9]++;
    }
    while (n <= 279) {
      static_ltree[n * 2 + 1] /*.Len*/ = 7;
      n++;
      bl_count[7]++;
    }
    while (n <= 287) {
      static_ltree[n * 2 + 1] /*.Len*/ = 8;
      n++;
      bl_count[8]++;
    }
    /* Codes 286 and 287 do not exist, but we must include them in the
     * tree construction to get a canonical Huffman tree (longest code
     * all ones)
     */
    gen_codes(static_ltree, L_CODES$1 + 1, bl_count);

    /* The static distance tree is trivial: */
    for (n = 0; n < D_CODES$1; n++) {
      static_dtree[n * 2 + 1] /*.Len*/ = 5;
      static_dtree[n * 2] /*.Code*/ = bi_reverse(n, 5);
    }

    // Now data ready and we can init static trees
    static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
    static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES$1, MAX_BITS$1);
    static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES$1, MAX_BL_BITS);

    //static_init_done = true;
  }


  /* ===========================================================================
   * Initialize a new block.
   */
  function init_block(s) {
    var n; /* iterates over tree elements */

    /* Initialize the trees. */
    for (n = 0; n < L_CODES$1; n++) {
      s.dyn_ltree[n * 2] /*.Freq*/ = 0;
    }
    for (n = 0; n < D_CODES$1; n++) {
      s.dyn_dtree[n * 2] /*.Freq*/ = 0;
    }
    for (n = 0; n < BL_CODES$1; n++) {
      s.bl_tree[n * 2] /*.Freq*/ = 0;
    }

    s.dyn_ltree[END_BLOCK * 2] /*.Freq*/ = 1;
    s.opt_len = s.static_len = 0;
    s.last_lit = s.matches = 0;
  }


  /* ===========================================================================
   * Flush the bit buffer and align the output on a byte boundary
   */
  function bi_windup(s) {
    if (s.bi_valid > 8) {
      put_short(s, s.bi_buf);
    } else if (s.bi_valid > 0) {
      //put_byte(s, (Byte)s->bi_buf);
      s.pending_buf[s.pending++] = s.bi_buf;
    }
    s.bi_buf = 0;
    s.bi_valid = 0;
  }

  /* ===========================================================================
   * Copy a stored block, storing first the length and its
   * one's complement if requested.
   */
  function copy_block(s, buf, len, header) {
  //DeflateState *s;
  //charf    *buf;    /* the input data */
  //unsigned len;     /* its length */
  //int      header;  /* true if block header must be written */

    bi_windup(s); /* align on byte boundary */

    {
      put_short(s, len);
      put_short(s, ~len);
    }
    //  while (len--) {
    //    put_byte(s, *buf++);
    //  }
    arraySet(s.pending_buf, s.window, buf, len, s.pending);
    s.pending += len;
  }

  /* ===========================================================================
   * Compares to subtrees, using the tree depth as tie breaker when
   * the subtrees have equal frequency. This minimizes the worst case length.
   */
  function smaller(tree, n, m, depth) {
    var _n2 = n * 2;
    var _m2 = m * 2;
    return (tree[_n2] /*.Freq*/ < tree[_m2] /*.Freq*/ ||
      (tree[_n2] /*.Freq*/ === tree[_m2] /*.Freq*/ && depth[n] <= depth[m]));
  }

  /* ===========================================================================
   * Restore the heap property by moving down the tree starting at node k,
   * exchanging a node with the smallest of its two sons if necessary, stopping
   * when the heap property is re-established (each father smaller than its
   * two sons).
   */
  function pqdownheap(s, tree, k)
  //    deflate_state *s;
  //    ct_data *tree;  /* the tree to restore */
  //    int k;               /* node to move down */
  {
    var v = s.heap[k];
    var j = k << 1; /* left son of k */
    while (j <= s.heap_len) {
      /* Set j to the smallest of the two sons: */
      if (j < s.heap_len &&
        smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
        j++;
      }
      /* Exit if v is smaller than both sons */
      if (smaller(tree, v, s.heap[j], s.depth)) {
        break;
      }

      /* Exchange v with the smallest son */
      s.heap[k] = s.heap[j];
      k = j;

      /* And continue down the tree, setting j to the left son of k */
      j <<= 1;
    }
    s.heap[k] = v;
  }


  // inlined manually
  // var SMALLEST = 1;

  /* ===========================================================================
   * Send the block data compressed using the given Huffman trees
   */
  function compress_block(s, ltree, dtree)
  //    deflate_state *s;
  //    const ct_data *ltree; /* literal tree */
  //    const ct_data *dtree; /* distance tree */
  {
    var dist; /* distance of matched string */
    var lc; /* match length or unmatched char (if dist == 0) */
    var lx = 0; /* running index in l_buf */
    var code; /* the code to send */
    var extra; /* number of extra bits to send */

    if (s.last_lit !== 0) {
      do {
        dist = (s.pending_buf[s.d_buf + lx * 2] << 8) | (s.pending_buf[s.d_buf + lx * 2 + 1]);
        lc = s.pending_buf[s.l_buf + lx];
        lx++;

        if (dist === 0) {
          send_code(s, lc, ltree); /* send a literal byte */
          //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
        } else {
          /* Here, lc is the match length - MIN_MATCH */
          code = _length_code[lc];
          send_code(s, code + LITERALS$1 + 1, ltree); /* send the length code */
          extra = extra_lbits[code];
          if (extra !== 0) {
            lc -= base_length[code];
            send_bits(s, lc, extra); /* send the extra length bits */
          }
          dist--; /* dist is now the match distance - 1 */
          code = d_code(dist);
          //Assert (code < D_CODES, "bad d_code");

          send_code(s, code, dtree); /* send the distance code */
          extra = extra_dbits[code];
          if (extra !== 0) {
            dist -= base_dist[code];
            send_bits(s, dist, extra); /* send the extra distance bits */
          }
        } /* literal or match pair ? */

        /* Check that the overlay between pending_buf and d_buf+l_buf is ok: */
        //Assert((uInt)(s->pending) < s->lit_bufsize + 2*lx,
        //       "pendingBuf overflow");

      } while (lx < s.last_lit);
    }

    send_code(s, END_BLOCK, ltree);
  }


  /* ===========================================================================
   * Construct one Huffman tree and assigns the code bit strings and lengths.
   * Update the total bit length for the current block.
   * IN assertion: the field freq is set for all tree elements.
   * OUT assertions: the fields len and code are set to the optimal bit length
   *     and corresponding code. The length opt_len is updated; static_len is
   *     also updated if stree is not null. The field max_code is set.
   */
  function build_tree(s, desc)
  //    deflate_state *s;
  //    tree_desc *desc; /* the tree descriptor */
  {
    var tree = desc.dyn_tree;
    var stree = desc.stat_desc.static_tree;
    var has_stree = desc.stat_desc.has_stree;
    var elems = desc.stat_desc.elems;
    var n, m; /* iterate over heap elements */
    var max_code = -1; /* largest code with non zero frequency */
    var node; /* new node being created */

    /* Construct the initial heap, with least frequent element in
     * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
     * heap[0] is not used.
     */
    s.heap_len = 0;
    s.heap_max = HEAP_SIZE$1;

    for (n = 0; n < elems; n++) {
      if (tree[n * 2] /*.Freq*/ !== 0) {
        s.heap[++s.heap_len] = max_code = n;
        s.depth[n] = 0;

      } else {
        tree[n * 2 + 1] /*.Len*/ = 0;
      }
    }

    /* The pkzip format requires that at least one distance code exists,
     * and that at least one bit should be sent even if there is only one
     * possible code. So to avoid special checks later on we force at least
     * two codes of non zero frequency.
     */
    while (s.heap_len < 2) {
      node = s.heap[++s.heap_len] = (max_code < 2 ? ++max_code : 0);
      tree[node * 2] /*.Freq*/ = 1;
      s.depth[node] = 0;
      s.opt_len--;

      if (has_stree) {
        s.static_len -= stree[node * 2 + 1] /*.Len*/ ;
      }
      /* node is 0 or 1 so it does not have extra bits */
    }
    desc.max_code = max_code;

    /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
     * establish sub-heaps of increasing lengths:
     */
    for (n = (s.heap_len >> 1 /*int /2*/ ); n >= 1; n--) {
      pqdownheap(s, tree, n);
    }

    /* Construct the Huffman tree by repeatedly combining the least two
     * frequent nodes.
     */
    node = elems; /* next internal node of the tree */
    do {
      //pqremove(s, tree, n);  /* n = node of least frequency */
      /*** pqremove ***/
      n = s.heap[1 /*SMALLEST*/ ];
      s.heap[1 /*SMALLEST*/ ] = s.heap[s.heap_len--];
      pqdownheap(s, tree, 1 /*SMALLEST*/ );
      /***/

      m = s.heap[1 /*SMALLEST*/ ]; /* m = node of next least frequency */

      s.heap[--s.heap_max] = n; /* keep the nodes sorted by frequency */
      s.heap[--s.heap_max] = m;

      /* Create a new node father of n and m */
      tree[node * 2] /*.Freq*/ = tree[n * 2] /*.Freq*/ + tree[m * 2] /*.Freq*/ ;
      s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
      tree[n * 2 + 1] /*.Dad*/ = tree[m * 2 + 1] /*.Dad*/ = node;

      /* and insert the new node in the heap */
      s.heap[1 /*SMALLEST*/ ] = node++;
      pqdownheap(s, tree, 1 /*SMALLEST*/ );

    } while (s.heap_len >= 2);

    s.heap[--s.heap_max] = s.heap[1 /*SMALLEST*/ ];

    /* At this point, the fields freq and dad are set. We can now
     * generate the bit lengths.
     */
    gen_bitlen(s, desc);

    /* The field len is now set, we can generate the bit codes */
    gen_codes(tree, max_code, s.bl_count);
  }


  /* ===========================================================================
   * Scan a literal or distance tree to determine the frequencies of the codes
   * in the bit length tree.
   */
  function scan_tree(s, tree, max_code)
  //    deflate_state *s;
  //    ct_data *tree;   /* the tree to be scanned */
  //    int max_code;    /* and its largest code of non zero frequency */
  {
    var n; /* iterates over all tree elements */
    var prevlen = -1; /* last emitted length */
    var curlen; /* length of current code */

    var nextlen = tree[0 * 2 + 1] /*.Len*/ ; /* length of next code */

    var count = 0; /* repeat count of the current code */
    var max_count = 7; /* max repeat count */
    var min_count = 4; /* min repeat count */

    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }
    tree[(max_code + 1) * 2 + 1] /*.Len*/ = 0xffff; /* guard */

    for (n = 0; n <= max_code; n++) {
      curlen = nextlen;
      nextlen = tree[(n + 1) * 2 + 1] /*.Len*/ ;

      if (++count < max_count && curlen === nextlen) {
        continue;

      } else if (count < min_count) {
        s.bl_tree[curlen * 2] /*.Freq*/ += count;

      } else if (curlen !== 0) {

        if (curlen !== prevlen) {
          s.bl_tree[curlen * 2] /*.Freq*/ ++;
        }
        s.bl_tree[REP_3_6 * 2] /*.Freq*/ ++;

      } else if (count <= 10) {
        s.bl_tree[REPZ_3_10 * 2] /*.Freq*/ ++;

      } else {
        s.bl_tree[REPZ_11_138 * 2] /*.Freq*/ ++;
      }

      count = 0;
      prevlen = curlen;

      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;

      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;

      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  }


  /* ===========================================================================
   * Send a literal or distance tree in compressed form, using the codes in
   * bl_tree.
   */
  function send_tree(s, tree, max_code)
  //    deflate_state *s;
  //    ct_data *tree; /* the tree to be scanned */
  //    int max_code;       /* and its largest code of non zero frequency */
  {
    var n; /* iterates over all tree elements */
    var prevlen = -1; /* last emitted length */
    var curlen; /* length of current code */

    var nextlen = tree[0 * 2 + 1] /*.Len*/ ; /* length of next code */

    var count = 0; /* repeat count of the current code */
    var max_count = 7; /* max repeat count */
    var min_count = 4; /* min repeat count */

    /* tree[max_code+1].Len = -1; */
    /* guard already set */
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }

    for (n = 0; n <= max_code; n++) {
      curlen = nextlen;
      nextlen = tree[(n + 1) * 2 + 1] /*.Len*/ ;

      if (++count < max_count && curlen === nextlen) {
        continue;

      } else if (count < min_count) {
        do {
          send_code(s, curlen, s.bl_tree);
        } while (--count !== 0);

      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          send_code(s, curlen, s.bl_tree);
          count--;
        }
        //Assert(count >= 3 && count <= 6, " 3_6?");
        send_code(s, REP_3_6, s.bl_tree);
        send_bits(s, count - 3, 2);

      } else if (count <= 10) {
        send_code(s, REPZ_3_10, s.bl_tree);
        send_bits(s, count - 3, 3);

      } else {
        send_code(s, REPZ_11_138, s.bl_tree);
        send_bits(s, count - 11, 7);
      }

      count = 0;
      prevlen = curlen;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;

      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;

      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  }


  /* ===========================================================================
   * Construct the Huffman tree for the bit lengths and return the index in
   * bl_order of the last bit length code to send.
   */
  function build_bl_tree(s) {
    var max_blindex; /* index of last bit length code of non zero freq */

    /* Determine the bit length frequencies for literal and distance trees */
    scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
    scan_tree(s, s.dyn_dtree, s.d_desc.max_code);

    /* Build the bit length tree: */
    build_tree(s, s.bl_desc);
    /* opt_len now includes the length of the tree representations, except
     * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
     */

    /* Determine the number of bit length codes to send. The pkzip format
     * requires that at least 4 bit length codes be sent. (appnote.txt says
     * 3 but the actual value used is 4.)
     */
    for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
      if (s.bl_tree[bl_order[max_blindex] * 2 + 1] /*.Len*/ !== 0) {
        break;
      }
    }
    /* Update opt_len to include the bit length tree and counts */
    s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
    //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
    //        s->opt_len, s->static_len));

    return max_blindex;
  }


  /* ===========================================================================
   * Send the header for a block using dynamic Huffman trees: the counts, the
   * lengths of the bit length codes, the literal tree and the distance tree.
   * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
   */
  function send_all_trees(s, lcodes, dcodes, blcodes)
  //    deflate_state *s;
  //    int lcodes, dcodes, blcodes; /* number of codes for each tree */
  {
    var rank; /* index in bl_order */

    //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
    //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
    //        "too many codes");
    //Tracev((stderr, "\nbl counts: "));
    send_bits(s, lcodes - 257, 5); /* not +255 as stated in appnote.txt */
    send_bits(s, dcodes - 1, 5);
    send_bits(s, blcodes - 4, 4); /* not -3 as stated in appnote.txt */
    for (rank = 0; rank < blcodes; rank++) {
      //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
      send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1] /*.Len*/ , 3);
    }
    //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

    send_tree(s, s.dyn_ltree, lcodes - 1); /* literal tree */
    //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

    send_tree(s, s.dyn_dtree, dcodes - 1); /* distance tree */
    //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
  }


  /* ===========================================================================
   * Check if the data type is TEXT or BINARY, using the following algorithm:
   * - TEXT if the two conditions below are satisfied:
   *    a) There are no non-portable control characters belonging to the
   *       "black list" (0..6, 14..25, 28..31).
   *    b) There is at least one printable character belonging to the
   *       "white list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
   * - BINARY otherwise.
   * - The following partially-portable control characters form a
   *   "gray list" that is ignored in this detection algorithm:
   *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
   * IN assertion: the fields Freq of dyn_ltree are set.
   */
  function detect_data_type(s) {
    /* black_mask is the bit mask of black-listed bytes
     * set bits 0..6, 14..25, and 28..31
     * 0xf3ffc07f = binary 11110011111111111100000001111111
     */
    var black_mask = 0xf3ffc07f;
    var n;

    /* Check for non-textual ("black-listed") bytes. */
    for (n = 0; n <= 31; n++, black_mask >>>= 1) {
      if ((black_mask & 1) && (s.dyn_ltree[n * 2] /*.Freq*/ !== 0)) {
        return Z_BINARY$1;
      }
    }

    /* Check for textual ("white-listed") bytes. */
    if (s.dyn_ltree[9 * 2] /*.Freq*/ !== 0 || s.dyn_ltree[10 * 2] /*.Freq*/ !== 0 ||
      s.dyn_ltree[13 * 2] /*.Freq*/ !== 0) {
      return Z_TEXT$1;
    }
    for (n = 32; n < LITERALS$1; n++) {
      if (s.dyn_ltree[n * 2] /*.Freq*/ !== 0) {
        return Z_TEXT$1;
      }
    }

    /* There are no "black-listed" or "white-listed" bytes:
     * this stream either is empty or has tolerated ("gray-listed") bytes only.
     */
    return Z_BINARY$1;
  }


  var static_init_done = false;

  /* ===========================================================================
   * Initialize the tree data structures for a new zlib stream.
   */
  function _tr_init(s) {

    if (!static_init_done) {
      tr_static_init();
      static_init_done = true;
    }

    s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
    s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
    s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);

    s.bi_buf = 0;
    s.bi_valid = 0;

    /* Initialize the first block of the first file: */
    init_block(s);
  }


  /* ===========================================================================
   * Send a stored block
   */
  function _tr_stored_block(s, buf, stored_len, last)
  //DeflateState *s;
  //charf *buf;       /* input block */
  //ulg stored_len;   /* length of input block */
  //int last;         /* one if this is the last block for a file */
  {
    send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3); /* send block type */
    copy_block(s, buf, stored_len); /* with header */
  }


  /* ===========================================================================
   * Send one empty static block to give enough lookahead for inflate.
   * This takes 10 bits, of which 7 may remain in the bit buffer.
   */
  function _tr_align(s) {
    send_bits(s, STATIC_TREES << 1, 3);
    send_code(s, END_BLOCK, static_ltree);
    bi_flush(s);
  }


  /* ===========================================================================
   * Determine the best encoding for the current block: dynamic trees, static
   * trees or store, and output the encoded block to the zip file.
   */
  function _tr_flush_block(s, buf, stored_len, last)
  //DeflateState *s;
  //charf *buf;       /* input block, or NULL if too old */
  //ulg stored_len;   /* length of input block */
  //int last;         /* one if this is the last block for a file */
  {
    var opt_lenb, static_lenb; /* opt_len and static_len in bytes */
    var max_blindex = 0; /* index of last bit length code of non zero freq */

    /* Build the Huffman trees unless a stored block is forced */
    if (s.level > 0) {

      /* Check if the file is binary or text */
      if (s.strm.data_type === Z_UNKNOWN$2) {
        s.strm.data_type = detect_data_type(s);
      }

      /* Construct the literal and distance trees */
      build_tree(s, s.l_desc);
      // Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
      //        s->static_len));

      build_tree(s, s.d_desc);
      // Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
      //        s->static_len));
      /* At this point, opt_len and static_len are the total bit lengths of
       * the compressed block data, excluding the tree representations.
       */

      /* Build the bit length tree for the above two trees, and get the index
       * in bl_order of the last bit length code to send.
       */
      max_blindex = build_bl_tree(s);

      /* Determine the best encoding. Compute the block lengths in bytes. */
      opt_lenb = (s.opt_len + 3 + 7) >>> 3;
      static_lenb = (s.static_len + 3 + 7) >>> 3;

      // Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
      //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
      //        s->last_lit));

      if (static_lenb <= opt_lenb) {
        opt_lenb = static_lenb;
      }

    } else {
      // Assert(buf != (char*)0, "lost buf");
      opt_lenb = static_lenb = stored_len + 5; /* force a stored block */
    }

    if ((stored_len + 4 <= opt_lenb) && (buf !== -1)) {
      /* 4: two words for the lengths */

      /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
       * Otherwise we can't have processed more than WSIZE input bytes since
       * the last block flush, because compression would have been
       * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
       * transform a block into a stored block.
       */
      _tr_stored_block(s, buf, stored_len, last);

    } else if (s.strategy === Z_FIXED$2 || static_lenb === opt_lenb) {

      send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
      compress_block(s, static_ltree, static_dtree);

    } else {
      send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
      send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
      compress_block(s, s.dyn_ltree, s.dyn_dtree);
    }
    // Assert (s->compressed_len == s->bits_sent, "bad compressed size");
    /* The above check is made mod 2^32, for files larger than 512 MB
     * and uLong implemented on 32 bits.
     */
    init_block(s);

    if (last) {
      bi_windup(s);
    }
    // Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
    //       s->compressed_len-7*last));
  }

  /* ===========================================================================
   * Save the match info and tally the frequency counts. Return true if
   * the current block must be flushed.
   */
  function _tr_tally(s, dist, lc)
  //    deflate_state *s;
  //    unsigned dist;  /* distance of matched string */
  //    unsigned lc;    /* match length-MIN_MATCH or unmatched char (if dist==0) */
  {
    //var out_length, in_length, dcode;

    s.pending_buf[s.d_buf + s.last_lit * 2] = (dist >>> 8) & 0xff;
    s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 0xff;

    s.pending_buf[s.l_buf + s.last_lit] = lc & 0xff;
    s.last_lit++;

    if (dist === 0) {
      /* lc is the unmatched char */
      s.dyn_ltree[lc * 2] /*.Freq*/ ++;
    } else {
      s.matches++;
      /* Here, lc is the match length - MIN_MATCH */
      dist--; /* dist = match distance - 1 */
      //Assert((ush)dist < (ush)MAX_DIST(s) &&
      //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
      //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

      s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2] /*.Freq*/ ++;
      s.dyn_dtree[d_code(dist) * 2] /*.Freq*/ ++;
    }

    // (!) This block is disabled in zlib defailts,
    // don't enable it for binary compatibility

    //#ifdef TRUNCATE_BLOCK
    //  /* Try to guess if it is profitable to stop the current block here */
    //  if ((s.last_lit & 0x1fff) === 0 && s.level > 2) {
    //    /* Compute an upper bound for the compressed length */
    //    out_length = s.last_lit*8;
    //    in_length = s.strstart - s.block_start;
    //
    //    for (dcode = 0; dcode < D_CODES; dcode++) {
    //      out_length += s.dyn_dtree[dcode*2]/*.Freq*/ * (5 + extra_dbits[dcode]);
    //    }
    //    out_length >>>= 3;
    //    //Tracev((stderr,"\nlast_lit %u, in %ld, out ~%ld(%ld%%) ",
    //    //       s->last_lit, in_length, out_length,
    //    //       100L - out_length*100L/in_length));
    //    if (s.matches < (s.last_lit>>1)/*int /2*/ && out_length < (in_length>>1)/*int /2*/) {
    //      return true;
    //    }
    //  }
    //#endif

    return (s.last_lit === s.lit_bufsize - 1);
    /* We avoid equality with lit_bufsize because of wraparound at 64K
     * on 16 bit machines and because stored blocks are restricted to
     * 64K-1 bytes.
     */
  }

  // Note: adler32 takes 12% for level 0 and 2% for level 6.
  // It doesn't worth to make additional optimizationa as in original.
  // Small size is preferable.

  function adler32(adler, buf, len, pos) {
    var s1 = (adler & 0xffff) |0,
        s2 = ((adler >>> 16) & 0xffff) |0,
        n = 0;

    while (len !== 0) {
      // Set limit ~ twice less than 5552, to keep
      // s2 in 31-bits, because we force signed ints.
      // in other case %= will fail.
      n = len > 2000 ? 2000 : len;
      len -= n;

      do {
        s1 = (s1 + buf[pos++]) |0;
        s2 = (s2 + s1) |0;
      } while (--n);

      s1 %= 65521;
      s2 %= 65521;
    }

    return (s1 | (s2 << 16)) |0;
  }

  // Note: we can't get significant speed boost here.
  // So write code to minimize size - no pregenerated tables
  // and array tools dependencies.


  // Use ordinary array, since untyped makes no boost here
  function makeTable() {
    var c, table = [];

    for (var n = 0; n < 256; n++) {
      c = n;
      for (var k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[n] = c;
    }

    return table;
  }

  // Create table on load. Just 255 signed longs. Not a problem.
  var crcTable = makeTable();


  function crc32(crc, buf, len, pos) {
    var t = crcTable,
        end = pos + len;

    crc ^= -1;

    for (var i = pos; i < end; i++) {
      crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
    }

    return (crc ^ (-1)); // >>> 0;
  }

  /* Public constants ==========================================================*/
  /* ===========================================================================*/


  /* Allowed flush values; see deflate() and inflate() below for details */
  var Z_NO_FLUSH$1 = 0;
  var Z_PARTIAL_FLUSH$1 = 1;
  //var Z_SYNC_FLUSH    = 2;
  var Z_FULL_FLUSH$1 = 3;
  var Z_FINISH$2 = 4;
  var Z_BLOCK$2 = 5;
  //var Z_TREES         = 6;


  /* Return codes for the compression/decompression functions. Negative values
   * are errors, positive values are used for special but normal events.
   */
  var Z_OK$2 = 0;
  var Z_STREAM_END$2 = 1;
  //var Z_NEED_DICT     = 2;
  //var Z_ERRNO         = -1;
  var Z_STREAM_ERROR$2 = -2;
  var Z_DATA_ERROR$2 = -3;
  //var Z_MEM_ERROR     = -4;
  var Z_BUF_ERROR$2 = -5;
  //var Z_VERSION_ERROR = -6;


  /* compression levels */
  //var Z_NO_COMPRESSION      = 0;
  //var Z_BEST_SPEED          = 1;
  //var Z_BEST_COMPRESSION    = 9;
  var Z_DEFAULT_COMPRESSION$1 = -1;


  var Z_FILTERED$1 = 1;
  var Z_HUFFMAN_ONLY$1 = 2;
  var Z_RLE$1 = 3;
  var Z_FIXED$1 = 4;

  /* Possible values of the data_type field (though see inflate()) */
  //var Z_BINARY              = 0;
  //var Z_TEXT                = 1;
  //var Z_ASCII               = 1; // = Z_TEXT
  var Z_UNKNOWN$1 = 2;


  /* The deflate compression method */
  var Z_DEFLATED$2 = 8;

  /*============================================================================*/


  var MAX_MEM_LEVEL = 9;


  var LENGTH_CODES = 29;
  /* number of length codes, not counting the special END_BLOCK code */
  var LITERALS = 256;
  /* number of literal bytes 0..255 */
  var L_CODES = LITERALS + 1 + LENGTH_CODES;
  /* number of Literal or Length codes, including the END_BLOCK code */
  var D_CODES = 30;
  /* number of distance codes */
  var BL_CODES = 19;
  /* number of codes used to transfer the bit lengths */
  var HEAP_SIZE = 2 * L_CODES + 1;
  /* maximum heap size */
  var MAX_BITS = 15;
  /* All codes must not exceed MAX_BITS bits */

  var MIN_MATCH = 3;
  var MAX_MATCH = 258;
  var MIN_LOOKAHEAD = (MAX_MATCH + MIN_MATCH + 1);

  var PRESET_DICT = 0x20;

  var INIT_STATE = 42;
  var EXTRA_STATE = 69;
  var NAME_STATE = 73;
  var COMMENT_STATE = 91;
  var HCRC_STATE = 103;
  var BUSY_STATE = 113;
  var FINISH_STATE = 666;

  var BS_NEED_MORE = 1; /* block not completed, need more input or more output */
  var BS_BLOCK_DONE = 2; /* block flush performed */
  var BS_FINISH_STARTED = 3; /* finish started, need only more output at next deflate */
  var BS_FINISH_DONE = 4; /* finish done, accept no more input or output */

  var OS_CODE = 0x03; // Unix :) . Don't detect, use this default.

  function err(strm, errorCode) {
    strm.msg = msg[errorCode];
    return errorCode;
  }

  function rank(f) {
    return ((f) << 1) - ((f) > 4 ? 9 : 0);
  }

  function zero(buf) {
    var len = buf.length;
    while (--len >= 0) {
      buf[len] = 0;
    }
  }


  /* =========================================================================
   * Flush as much pending output as possible. All deflate() output goes
   * through this function so some applications may wish to modify it
   * to avoid allocating a large strm->output buffer and copying into it.
   * (See also read_buf()).
   */
  function flush_pending(strm) {
    var s = strm.state;

    //_tr_flush_bits(s);
    var len = s.pending;
    if (len > strm.avail_out) {
      len = strm.avail_out;
    }
    if (len === 0) {
      return;
    }

    arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
    strm.next_out += len;
    s.pending_out += len;
    strm.total_out += len;
    strm.avail_out -= len;
    s.pending -= len;
    if (s.pending === 0) {
      s.pending_out = 0;
    }
  }


  function flush_block_only(s, last) {
    _tr_flush_block(s, (s.block_start >= 0 ? s.block_start : -1), s.strstart - s.block_start, last);
    s.block_start = s.strstart;
    flush_pending(s.strm);
  }


  function put_byte(s, b) {
    s.pending_buf[s.pending++] = b;
  }


  /* =========================================================================
   * Put a short in the pending buffer. The 16-bit value is put in MSB order.
   * IN assertion: the stream state is correct and there is enough room in
   * pending_buf.
   */
  function putShortMSB(s, b) {
    //  put_byte(s, (Byte)(b >> 8));
    //  put_byte(s, (Byte)(b & 0xff));
    s.pending_buf[s.pending++] = (b >>> 8) & 0xff;
    s.pending_buf[s.pending++] = b & 0xff;
  }


  /* ===========================================================================
   * Read a new buffer from the current input stream, update the adler32
   * and total number of bytes read.  All deflate() input goes through
   * this function so some applications may wish to modify it to avoid
   * allocating a large strm->input buffer and copying from it.
   * (See also flush_pending()).
   */
  function read_buf(strm, buf, start, size) {
    var len = strm.avail_in;

    if (len > size) {
      len = size;
    }
    if (len === 0) {
      return 0;
    }

    strm.avail_in -= len;

    // zmemcpy(buf, strm->next_in, len);
    arraySet(buf, strm.input, strm.next_in, len, start);
    if (strm.state.wrap === 1) {
      strm.adler = adler32(strm.adler, buf, len, start);
    } else if (strm.state.wrap === 2) {
      strm.adler = crc32(strm.adler, buf, len, start);
    }

    strm.next_in += len;
    strm.total_in += len;

    return len;
  }


  /* ===========================================================================
   * Set match_start to the longest match starting at the given string and
   * return its length. Matches shorter or equal to prev_length are discarded,
   * in which case the result is equal to prev_length and match_start is
   * garbage.
   * IN assertions: cur_match is the head of the hash chain for the current
   *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
   * OUT assertion: the match length is not greater than s->lookahead.
   */
  function longest_match(s, cur_match) {
    var chain_length = s.max_chain_length; /* max hash chain length */
    var scan = s.strstart; /* current string */
    var match; /* matched string */
    var len; /* length of current match */
    var best_len = s.prev_length; /* best match length so far */
    var nice_match = s.nice_match; /* stop if match long enough */
    var limit = (s.strstart > (s.w_size - MIN_LOOKAHEAD)) ?
      s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0 /*NIL*/ ;

    var _win = s.window; // shortcut

    var wmask = s.w_mask;
    var prev = s.prev;

    /* Stop when cur_match becomes <= limit. To simplify the code,
     * we prevent matches with the string of window index 0.
     */

    var strend = s.strstart + MAX_MATCH;
    var scan_end1 = _win[scan + best_len - 1];
    var scan_end = _win[scan + best_len];

    /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
     * It is easy to get rid of this optimization if necessary.
     */
    // Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

    /* Do not waste too much time if we already have a good match: */
    if (s.prev_length >= s.good_match) {
      chain_length >>= 2;
    }
    /* Do not look for matches beyond the end of the input. This is necessary
     * to make deflate deterministic.
     */
    if (nice_match > s.lookahead) {
      nice_match = s.lookahead;
    }

    // Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

    do {
      // Assert(cur_match < s->strstart, "no future");
      match = cur_match;

      /* Skip to next match if the match length cannot increase
       * or if the match length is less than 2.  Note that the checks below
       * for insufficient lookahead only occur occasionally for performance
       * reasons.  Therefore uninitialized memory will be accessed, and
       * conditional jumps will be made that depend on those values.
       * However the length of the match is limited to the lookahead, so
       * the output of deflate is not affected by the uninitialized values.
       */

      if (_win[match + best_len] !== scan_end ||
        _win[match + best_len - 1] !== scan_end1 ||
        _win[match] !== _win[scan] ||
        _win[++match] !== _win[scan + 1]) {
        continue;
      }

      /* The check at best_len-1 can be removed because it will be made
       * again later. (This heuristic is not always a win.)
       * It is not necessary to compare scan[2] and match[2] since they
       * are always equal when the other bytes match, given that
       * the hash keys are equal and that HASH_BITS >= 8.
       */
      scan += 2;
      match++;
      // Assert(*scan == *match, "match[2]?");

      /* We check for insufficient lookahead only every 8th comparison;
       * the 256th check will be made at strstart+258.
       */
      do {
        /*jshint noempty:false*/
      } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
        scan < strend);

      // Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

      len = MAX_MATCH - (strend - scan);
      scan = strend - MAX_MATCH;

      if (len > best_len) {
        s.match_start = cur_match;
        best_len = len;
        if (len >= nice_match) {
          break;
        }
        scan_end1 = _win[scan + best_len - 1];
        scan_end = _win[scan + best_len];
      }
    } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);

    if (best_len <= s.lookahead) {
      return best_len;
    }
    return s.lookahead;
  }


  /* ===========================================================================
   * Fill the window when the lookahead becomes insufficient.
   * Updates strstart and lookahead.
   *
   * IN assertion: lookahead < MIN_LOOKAHEAD
   * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
   *    At least one byte has been read, or avail_in == 0; reads are
   *    performed for at least two bytes (required for the zip translate_eol
   *    option -- not supported here).
   */
  function fill_window(s) {
    var _w_size = s.w_size;
    var p, n, m, more, str;

    //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

    do {
      more = s.window_size - s.lookahead - s.strstart;

      // JS ints have 32 bit, block below not needed
      /* Deal with !@#$% 64K limit: */
      //if (sizeof(int) <= 2) {
      //    if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
      //        more = wsize;
      //
      //  } else if (more == (unsigned)(-1)) {
      //        /* Very unlikely, but possible on 16 bit machine if
      //         * strstart == 0 && lookahead == 1 (input done a byte at time)
      //         */
      //        more--;
      //    }
      //}


      /* If the window is almost full and there is insufficient lookahead,
       * move the upper half to the lower one to make room in the upper half.
       */
      if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {

        arraySet(s.window, s.window, _w_size, _w_size, 0);
        s.match_start -= _w_size;
        s.strstart -= _w_size;
        /* we now have strstart >= MAX_DIST */
        s.block_start -= _w_size;

        /* Slide the hash table (could be avoided with 32 bit values
         at the expense of memory usage). We slide even when level == 0
         to keep the hash table consistent if we switch back to level > 0
         later. (Using level 0 permanently is not an optimal usage of
         zlib, so we don't care about this pathological case.)
         */

        n = s.hash_size;
        p = n;
        do {
          m = s.head[--p];
          s.head[p] = (m >= _w_size ? m - _w_size : 0);
        } while (--n);

        n = _w_size;
        p = n;
        do {
          m = s.prev[--p];
          s.prev[p] = (m >= _w_size ? m - _w_size : 0);
          /* If n is not on any hash chain, prev[n] is garbage but
           * its value will never be used.
           */
        } while (--n);

        more += _w_size;
      }
      if (s.strm.avail_in === 0) {
        break;
      }

      /* If there was no sliding:
       *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
       *    more == window_size - lookahead - strstart
       * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
       * => more >= window_size - 2*WSIZE + 2
       * In the BIG_MEM or MMAP case (not yet supported),
       *   window_size == input_size + MIN_LOOKAHEAD  &&
       *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
       * Otherwise, window_size == 2*WSIZE so more >= 2.
       * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
       */
      //Assert(more >= 2, "more < 2");
      n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
      s.lookahead += n;

      /* Initialize the hash value now that we have some input: */
      if (s.lookahead + s.insert >= MIN_MATCH) {
        str = s.strstart - s.insert;
        s.ins_h = s.window[str];

        /* UPDATE_HASH(s, s->ins_h, s->window[str + 1]); */
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + 1]) & s.hash_mask;
        //#if MIN_MATCH != 3
        //        Call update_hash() MIN_MATCH-3 more times
        //#endif
        while (s.insert) {
          /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;

          s.prev[str & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = str;
          str++;
          s.insert--;
          if (s.lookahead + s.insert < MIN_MATCH) {
            break;
          }
        }
      }
      /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
       * but this is not important since only literal bytes will be emitted.
       */

    } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);

    /* If the WIN_INIT bytes after the end of the current data have never been
     * written, then zero those bytes in order to avoid memory check reports of
     * the use of uninitialized (or uninitialised as Julian writes) bytes by
     * the longest match routines.  Update the high water mark for the next
     * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
     * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
     */
    //  if (s.high_water < s.window_size) {
    //    var curr = s.strstart + s.lookahead;
    //    var init = 0;
    //
    //    if (s.high_water < curr) {
    //      /* Previous high water mark below current data -- zero WIN_INIT
    //       * bytes or up to end of window, whichever is less.
    //       */
    //      init = s.window_size - curr;
    //      if (init > WIN_INIT)
    //        init = WIN_INIT;
    //      zmemzero(s->window + curr, (unsigned)init);
    //      s->high_water = curr + init;
    //    }
    //    else if (s->high_water < (ulg)curr + WIN_INIT) {
    //      /* High water mark at or above current data, but below current data
    //       * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
    //       * to end of window, whichever is less.
    //       */
    //      init = (ulg)curr + WIN_INIT - s->high_water;
    //      if (init > s->window_size - s->high_water)
    //        init = s->window_size - s->high_water;
    //      zmemzero(s->window + s->high_water, (unsigned)init);
    //      s->high_water += init;
    //    }
    //  }
    //
    //  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
    //    "not enough room for search");
  }

  /* ===========================================================================
   * Copy without compression as much as possible from the input stream, return
   * the current block state.
   * This function does not insert new strings in the dictionary since
   * uncompressible data is probably not useful. This function is used
   * only for the level=0 compression option.
   * NOTE: this function should be optimized to avoid extra copying from
   * window to pending_buf.
   */
  function deflate_stored(s, flush) {
    /* Stored blocks are limited to 0xffff bytes, pending_buf is limited
     * to pending_buf_size, and each stored block has a 5 byte header:
     */
    var max_block_size = 0xffff;

    if (max_block_size > s.pending_buf_size - 5) {
      max_block_size = s.pending_buf_size - 5;
    }

    /* Copy as much as possible from input to output: */
    for (;;) {
      /* Fill the window as much as possible: */
      if (s.lookahead <= 1) {

        //Assert(s->strstart < s->w_size+MAX_DIST(s) ||
        //  s->block_start >= (long)s->w_size, "slide too late");
        //      if (!(s.strstart < s.w_size + (s.w_size - MIN_LOOKAHEAD) ||
        //        s.block_start >= s.w_size)) {
        //        throw  new Error("slide too late");
        //      }

        fill_window(s);
        if (s.lookahead === 0 && flush === Z_NO_FLUSH$1) {
          return BS_NEED_MORE;
        }

        if (s.lookahead === 0) {
          break;
        }
        /* flush the current block */
      }
      //Assert(s->block_start >= 0L, "block gone");
      //    if (s.block_start < 0) throw new Error("block gone");

      s.strstart += s.lookahead;
      s.lookahead = 0;

      /* Emit a stored block if pending_buf will be full: */
      var max_start = s.block_start + max_block_size;

      if (s.strstart === 0 || s.strstart >= max_start) {
        /* strstart == 0 is possible when wraparound on 16-bit machine */
        s.lookahead = s.strstart - max_start;
        s.strstart = max_start;
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/


      }
      /* Flush if we may have to slide, otherwise block_start may become
       * negative and the data will be gone:
       */
      if (s.strstart - s.block_start >= (s.w_size - MIN_LOOKAHEAD)) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }
    }

    s.insert = 0;

    if (flush === Z_FINISH$2) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      /***/
      return BS_FINISH_DONE;
    }

    if (s.strstart > s.block_start) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }

    return BS_NEED_MORE;
  }

  /* ===========================================================================
   * Compress as much as possible from the input stream, return the current
   * block state.
   * This function does not perform lazy evaluation of matches and inserts
   * new strings in the dictionary only for unmatched strings or for short
   * matches. It is used only for the fast compression options.
   */
  function deflate_fast(s, flush) {
    var hash_head; /* head of the hash chain */
    var bflush; /* set if current block must be flushed */

    for (;;) {
      /* Make sure that we always have enough lookahead, except
       * at the end of the input file. We need MAX_MATCH bytes
       * for the next match, plus MIN_MATCH bytes to insert the
       * string following the next match.
       */
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$1) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break; /* flush the current block */
        }
      }

      /* Insert the string window[strstart .. strstart+2] in the
       * dictionary, and set hash_head to the head of the hash chain:
       */
      hash_head = 0 /*NIL*/ ;
      if (s.lookahead >= MIN_MATCH) {
        /*** INSERT_STRING(s, s.strstart, hash_head); ***/
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
        /***/
      }

      /* Find the longest match, discarding those <= prev_length.
       * At this point we have always match_length < MIN_MATCH
       */
      if (hash_head !== 0 /*NIL*/ && ((s.strstart - hash_head) <= (s.w_size - MIN_LOOKAHEAD))) {
        /* To simplify the code, we prevent matches with the string
         * of window index 0 (in particular we have to avoid a match
         * of the string with itself at the start of the input file).
         */
        s.match_length = longest_match(s, hash_head);
        /* longest_match() sets match_start */
      }
      if (s.match_length >= MIN_MATCH) {
        // check_match(s, s.strstart, s.match_start, s.match_length); // for debug only

        /*** _tr_tally_dist(s, s.strstart - s.match_start,
                       s.match_length - MIN_MATCH, bflush); ***/
        bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);

        s.lookahead -= s.match_length;

        /* Insert new strings in the hash table only if the match length
         * is not too large. This saves time but degrades compression.
         */
        if (s.match_length <= s.max_lazy_match /*max_insert_length*/ && s.lookahead >= MIN_MATCH) {
          s.match_length--; /* string at strstart already in table */
          do {
            s.strstart++;
            /*** INSERT_STRING(s, s.strstart, hash_head); ***/
            s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
            /***/
            /* strstart never exceeds WSIZE-MAX_MATCH, so there are
             * always MIN_MATCH bytes ahead.
             */
          } while (--s.match_length !== 0);
          s.strstart++;
        } else {
          s.strstart += s.match_length;
          s.match_length = 0;
          s.ins_h = s.window[s.strstart];
          /* UPDATE_HASH(s, s.ins_h, s.window[s.strstart+1]); */
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + 1]) & s.hash_mask;

          //#if MIN_MATCH != 3
          //                Call UPDATE_HASH() MIN_MATCH-3 more times
          //#endif
          /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
           * matter since it will be recomputed at next deflate call.
           */
        }
      } else {
        /* No match, output a literal byte */
        //Tracevv((stderr,"%c", s.window[s.strstart]));
        /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
        bflush = _tr_tally(s, 0, s.window[s.strstart]);

        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }
    }
    s.insert = ((s.strstart < (MIN_MATCH - 1)) ? s.strstart : MIN_MATCH - 1);
    if (flush === Z_FINISH$2) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      /***/
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
    return BS_BLOCK_DONE;
  }

  /* ===========================================================================
   * Same as above, but achieves better compression. We use a lazy
   * evaluation for matches: a match is finally adopted only if there is
   * no better match at the next window position.
   */
  function deflate_slow(s, flush) {
    var hash_head; /* head of hash chain */
    var bflush; /* set if current block must be flushed */

    var max_insert;

    /* Process the input block. */
    for (;;) {
      /* Make sure that we always have enough lookahead, except
       * at the end of the input file. We need MAX_MATCH bytes
       * for the next match, plus MIN_MATCH bytes to insert the
       * string following the next match.
       */
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$1) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        } /* flush the current block */
      }

      /* Insert the string window[strstart .. strstart+2] in the
       * dictionary, and set hash_head to the head of the hash chain:
       */
      hash_head = 0 /*NIL*/ ;
      if (s.lookahead >= MIN_MATCH) {
        /*** INSERT_STRING(s, s.strstart, hash_head); ***/
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
        /***/
      }

      /* Find the longest match, discarding those <= prev_length.
       */
      s.prev_length = s.match_length;
      s.prev_match = s.match_start;
      s.match_length = MIN_MATCH - 1;

      if (hash_head !== 0 /*NIL*/ && s.prev_length < s.max_lazy_match &&
        s.strstart - hash_head <= (s.w_size - MIN_LOOKAHEAD) /*MAX_DIST(s)*/ ) {
        /* To simplify the code, we prevent matches with the string
         * of window index 0 (in particular we have to avoid a match
         * of the string with itself at the start of the input file).
         */
        s.match_length = longest_match(s, hash_head);
        /* longest_match() sets match_start */

        if (s.match_length <= 5 &&
          (s.strategy === Z_FILTERED$1 || (s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096 /*TOO_FAR*/ ))) {

          /* If prev_match is also MIN_MATCH, match_start is garbage
           * but we will ignore the current match anyway.
           */
          s.match_length = MIN_MATCH - 1;
        }
      }
      /* If there was a match at the previous step and the current
       * match is not better, output the previous match:
       */
      if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
        max_insert = s.strstart + s.lookahead - MIN_MATCH;
        /* Do not insert strings in hash table beyond this. */

        //check_match(s, s.strstart-1, s.prev_match, s.prev_length);

        /***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
                       s.prev_length - MIN_MATCH, bflush);***/
        bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
        /* Insert in hash table all strings up to the end of the match.
         * strstart-1 and strstart are already inserted. If there is not
         * enough lookahead, the last two strings are not inserted in
         * the hash table.
         */
        s.lookahead -= s.prev_length - 1;
        s.prev_length -= 2;
        do {
          if (++s.strstart <= max_insert) {
            /*** INSERT_STRING(s, s.strstart, hash_head); ***/
            s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
            /***/
          }
        } while (--s.prev_length !== 0);
        s.match_available = 0;
        s.match_length = MIN_MATCH - 1;
        s.strstart++;

        if (bflush) {
          /*** FLUSH_BLOCK(s, 0); ***/
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
          /***/
        }

      } else if (s.match_available) {
        /* If there was no match at the previous position, output a
         * single literal. If there was a match but the current match
         * is longer, truncate the previous match to a single literal.
         */
        //Tracevv((stderr,"%c", s->window[s->strstart-1]));
        /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
        bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);

        if (bflush) {
          /*** FLUSH_BLOCK_ONLY(s, 0) ***/
          flush_block_only(s, false);
          /***/
        }
        s.strstart++;
        s.lookahead--;
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      } else {
        /* There is no previous match to compare with, wait for
         * the next step to decide.
         */
        s.match_available = 1;
        s.strstart++;
        s.lookahead--;
      }
    }
    //Assert (flush != Z_NO_FLUSH, "no flush?");
    if (s.match_available) {
      //Tracevv((stderr,"%c", s->window[s->strstart-1]));
      /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);

      s.match_available = 0;
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
    if (flush === Z_FINISH$2) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      /***/
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }

    return BS_BLOCK_DONE;
  }


  /* ===========================================================================
   * For Z_RLE, simply look for runs of bytes, generate matches only of distance
   * one.  Do not maintain a hash table.  (It will be regenerated if this run of
   * deflate switches away from Z_RLE.)
   */
  function deflate_rle(s, flush) {
    var bflush; /* set if current block must be flushed */
    var prev; /* byte at distance one to match */
    var scan, strend; /* scan goes up to strend for length of run */

    var _win = s.window;

    for (;;) {
      /* Make sure that we always have enough lookahead, except
       * at the end of the input file. We need MAX_MATCH bytes
       * for the longest run, plus one for the unrolled loop.
       */
      if (s.lookahead <= MAX_MATCH) {
        fill_window(s);
        if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$1) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        } /* flush the current block */
      }

      /* See how many times the previous byte repeats */
      s.match_length = 0;
      if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
        scan = s.strstart - 1;
        prev = _win[scan];
        if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
          strend = s.strstart + MAX_MATCH;
          do {
            /*jshint noempty:false*/
          } while (prev === _win[++scan] && prev === _win[++scan] &&
            prev === _win[++scan] && prev === _win[++scan] &&
            prev === _win[++scan] && prev === _win[++scan] &&
            prev === _win[++scan] && prev === _win[++scan] &&
            scan < strend);
          s.match_length = MAX_MATCH - (strend - scan);
          if (s.match_length > s.lookahead) {
            s.match_length = s.lookahead;
          }
        }
        //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
      }

      /* Emit match if have run of MIN_MATCH or longer, else emit literal */
      if (s.match_length >= MIN_MATCH) {
        //check_match(s, s.strstart, s.strstart - 1, s.match_length);

        /*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
        bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);

        s.lookahead -= s.match_length;
        s.strstart += s.match_length;
        s.match_length = 0;
      } else {
        /* No match, output a literal byte */
        //Tracevv((stderr,"%c", s->window[s->strstart]));
        /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
        bflush = _tr_tally(s, 0, s.window[s.strstart]);

        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH$2) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      /***/
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
    return BS_BLOCK_DONE;
  }

  /* ===========================================================================
   * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
   * (It will be regenerated if this run of deflate switches away from Huffman.)
   */
  function deflate_huff(s, flush) {
    var bflush; /* set if current block must be flushed */

    for (;;) {
      /* Make sure that we have a literal to write. */
      if (s.lookahead === 0) {
        fill_window(s);
        if (s.lookahead === 0) {
          if (flush === Z_NO_FLUSH$1) {
            return BS_NEED_MORE;
          }
          break; /* flush the current block */
        }
      }

      /* Output a literal byte */
      s.match_length = 0;
      //Tracevv((stderr,"%c", s->window[s->strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH$2) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      /***/
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
    return BS_BLOCK_DONE;
  }

  /* Values for max_lazy_match, good_match and max_chain_length, depending on
   * the desired pack level (0..9). The values given below have been tuned to
   * exclude worst case performance for pathological files. Better values may be
   * found for specific files.
   */
  function Config(good_length, max_lazy, nice_length, max_chain, func) {
    this.good_length = good_length;
    this.max_lazy = max_lazy;
    this.nice_length = nice_length;
    this.max_chain = max_chain;
    this.func = func;
  }

  var configuration_table;

  configuration_table = [
    /*      good lazy nice chain */
    new Config(0, 0, 0, 0, deflate_stored), /* 0 store only */
    new Config(4, 4, 8, 4, deflate_fast), /* 1 max speed, no lazy matches */
    new Config(4, 5, 16, 8, deflate_fast), /* 2 */
    new Config(4, 6, 32, 32, deflate_fast), /* 3 */

    new Config(4, 4, 16, 16, deflate_slow), /* 4 lazy matches */
    new Config(8, 16, 32, 32, deflate_slow), /* 5 */
    new Config(8, 16, 128, 128, deflate_slow), /* 6 */
    new Config(8, 32, 128, 256, deflate_slow), /* 7 */
    new Config(32, 128, 258, 1024, deflate_slow), /* 8 */
    new Config(32, 258, 258, 4096, deflate_slow) /* 9 max compression */
  ];


  /* ===========================================================================
   * Initialize the "longest match" routines for a new zlib stream
   */
  function lm_init(s) {
    s.window_size = 2 * s.w_size;

    /*** CLEAR_HASH(s); ***/
    zero(s.head); // Fill with NIL (= 0);

    /* Set the default configuration parameters:
     */
    s.max_lazy_match = configuration_table[s.level].max_lazy;
    s.good_match = configuration_table[s.level].good_length;
    s.nice_match = configuration_table[s.level].nice_length;
    s.max_chain_length = configuration_table[s.level].max_chain;

    s.strstart = 0;
    s.block_start = 0;
    s.lookahead = 0;
    s.insert = 0;
    s.match_length = s.prev_length = MIN_MATCH - 1;
    s.match_available = 0;
    s.ins_h = 0;
  }


  function DeflateState() {
    this.strm = null; /* pointer back to this zlib stream */
    this.status = 0; /* as the name implies */
    this.pending_buf = null; /* output still pending */
    this.pending_buf_size = 0; /* size of pending_buf */
    this.pending_out = 0; /* next pending byte to output to the stream */
    this.pending = 0; /* nb of bytes in the pending buffer */
    this.wrap = 0; /* bit 0 true for zlib, bit 1 true for gzip */
    this.gzhead = null; /* gzip header information to write */
    this.gzindex = 0; /* where in extra, name, or comment */
    this.method = Z_DEFLATED$2; /* can only be DEFLATED */
    this.last_flush = -1; /* value of flush param for previous deflate call */

    this.w_size = 0; /* LZ77 window size (32K by default) */
    this.w_bits = 0; /* log2(w_size)  (8..16) */
    this.w_mask = 0; /* w_size - 1 */

    this.window = null;
    /* Sliding window. Input bytes are read into the second half of the window,
     * and move to the first half later to keep a dictionary of at least wSize
     * bytes. With this organization, matches are limited to a distance of
     * wSize-MAX_MATCH bytes, but this ensures that IO is always
     * performed with a length multiple of the block size.
     */

    this.window_size = 0;
    /* Actual size of window: 2*wSize, except when the user input buffer
     * is directly used as sliding window.
     */

    this.prev = null;
    /* Link to older string with same hash index. To limit the size of this
     * array to 64K, this link is maintained only for the last 32K strings.
     * An index in this array is thus a window index modulo 32K.
     */

    this.head = null; /* Heads of the hash chains or NIL. */

    this.ins_h = 0; /* hash index of string to be inserted */
    this.hash_size = 0; /* number of elements in hash table */
    this.hash_bits = 0; /* log2(hash_size) */
    this.hash_mask = 0; /* hash_size-1 */

    this.hash_shift = 0;
    /* Number of bits by which ins_h must be shifted at each input
     * step. It must be such that after MIN_MATCH steps, the oldest
     * byte no longer takes part in the hash key, that is:
     *   hash_shift * MIN_MATCH >= hash_bits
     */

    this.block_start = 0;
    /* Window position at the beginning of the current output block. Gets
     * negative when the window is moved backwards.
     */

    this.match_length = 0; /* length of best match */
    this.prev_match = 0; /* previous match */
    this.match_available = 0; /* set if previous match exists */
    this.strstart = 0; /* start of string to insert */
    this.match_start = 0; /* start of matching string */
    this.lookahead = 0; /* number of valid bytes ahead in window */

    this.prev_length = 0;
    /* Length of the best match at previous step. Matches not greater than this
     * are discarded. This is used in the lazy match evaluation.
     */

    this.max_chain_length = 0;
    /* To speed up deflation, hash chains are never searched beyond this
     * length.  A higher limit improves compression ratio but degrades the
     * speed.
     */

    this.max_lazy_match = 0;
    /* Attempt to find a better match only when the current match is strictly
     * smaller than this value. This mechanism is used only for compression
     * levels >= 4.
     */
    // That's alias to max_lazy_match, don't use directly
    //this.max_insert_length = 0;
    /* Insert new strings in the hash table only if the match length is not
     * greater than this length. This saves time but degrades compression.
     * max_insert_length is used only for compression levels <= 3.
     */

    this.level = 0; /* compression level (1..9) */
    this.strategy = 0; /* favor or force Huffman coding*/

    this.good_match = 0;
    /* Use a faster search when the previous match is longer than this */

    this.nice_match = 0; /* Stop searching when current match exceeds this */

    /* used by c: */

    /* Didn't use ct_data typedef below to suppress compiler warning */

    // struct ct_data_s dyn_ltree[HEAP_SIZE];   /* literal and length tree */
    // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
    // struct ct_data_s bl_tree[2*BL_CODES+1];  /* Huffman tree for bit lengths */

    // Use flat array of DOUBLE size, with interleaved fata,
    // because JS does not support effective
    this.dyn_ltree = new Buf16(HEAP_SIZE * 2);
    this.dyn_dtree = new Buf16((2 * D_CODES + 1) * 2);
    this.bl_tree = new Buf16((2 * BL_CODES + 1) * 2);
    zero(this.dyn_ltree);
    zero(this.dyn_dtree);
    zero(this.bl_tree);

    this.l_desc = null; /* desc. for literal tree */
    this.d_desc = null; /* desc. for distance tree */
    this.bl_desc = null; /* desc. for bit length tree */

    //ush bl_count[MAX_BITS+1];
    this.bl_count = new Buf16(MAX_BITS + 1);
    /* number of codes at each bit length for an optimal tree */

    //int heap[2*L_CODES+1];      /* heap used to build the Huffman trees */
    this.heap = new Buf16(2 * L_CODES + 1); /* heap used to build the Huffman trees */
    zero(this.heap);

    this.heap_len = 0; /* number of elements in the heap */
    this.heap_max = 0; /* element of largest frequency */
    /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
     * The same heap array is used to build all
     */

    this.depth = new Buf16(2 * L_CODES + 1); //uch depth[2*L_CODES+1];
    zero(this.depth);
    /* Depth of each subtree used as tie breaker for trees of equal frequency
     */

    this.l_buf = 0; /* buffer index for literals or lengths */

    this.lit_bufsize = 0;
    /* Size of match buffer for literals/lengths.  There are 4 reasons for
     * limiting lit_bufsize to 64K:
     *   - frequencies can be kept in 16 bit counters
     *   - if compression is not successful for the first block, all input
     *     data is still in the window so we can still emit a stored block even
     *     when input comes from standard input.  (This can also be done for
     *     all blocks if lit_bufsize is not greater than 32K.)
     *   - if compression is not successful for a file smaller than 64K, we can
     *     even emit a stored file instead of a stored block (saving 5 bytes).
     *     This is applicable only for zip (not gzip or zlib).
     *   - creating new Huffman trees less frequently may not provide fast
     *     adaptation to changes in the input data statistics. (Take for
     *     example a binary file with poorly compressible code followed by
     *     a highly compressible string table.) Smaller buffer sizes give
     *     fast adaptation but have of course the overhead of transmitting
     *     trees more frequently.
     *   - I can't count above 4
     */

    this.last_lit = 0; /* running index in l_buf */

    this.d_buf = 0;
    /* Buffer index for distances. To simplify the code, d_buf and l_buf have
     * the same number of elements. To use different lengths, an extra flag
     * array would be necessary.
     */

    this.opt_len = 0; /* bit length of current block with optimal trees */
    this.static_len = 0; /* bit length of current block with static trees */
    this.matches = 0; /* number of string matches in current block */
    this.insert = 0; /* bytes at end of window left to insert */


    this.bi_buf = 0;
    /* Output buffer. bits are inserted starting at the bottom (least
     * significant bits).
     */
    this.bi_valid = 0;
    /* Number of valid bits in bi_buf.  All bits above the last valid bit
     * are always zero.
     */

    // Used for window memory init. We safely ignore it for JS. That makes
    // sense only for pointers and memory check tools.
    //this.high_water = 0;
    /* High water mark offset in window for initialized bytes -- bytes above
     * this are set to zero in order to avoid memory check warnings when
     * longest match routines access bytes past the input.  This is then
     * updated to the new high water mark.
     */
  }


  function deflateResetKeep(strm) {
    var s;

    if (!strm || !strm.state) {
      return err(strm, Z_STREAM_ERROR$2);
    }

    strm.total_in = strm.total_out = 0;
    strm.data_type = Z_UNKNOWN$1;

    s = strm.state;
    s.pending = 0;
    s.pending_out = 0;

    if (s.wrap < 0) {
      s.wrap = -s.wrap;
      /* was made negative by deflate(..., Z_FINISH); */
    }
    s.status = (s.wrap ? INIT_STATE : BUSY_STATE);
    strm.adler = (s.wrap === 2) ?
      0 // crc32(0, Z_NULL, 0)
      :
      1; // adler32(0, Z_NULL, 0)
    s.last_flush = Z_NO_FLUSH$1;
    _tr_init(s);
    return Z_OK$2;
  }


  function deflateReset(strm) {
    var ret = deflateResetKeep(strm);
    if (ret === Z_OK$2) {
      lm_init(strm.state);
    }
    return ret;
  }


  function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
    if (!strm) { // === Z_NULL
      return Z_STREAM_ERROR$2;
    }
    var wrap = 1;

    if (level === Z_DEFAULT_COMPRESSION$1) {
      level = 6;
    }

    if (windowBits < 0) { /* suppress zlib wrapper */
      wrap = 0;
      windowBits = -windowBits;
    } else if (windowBits > 15) {
      wrap = 2; /* write gzip wrapper instead */
      windowBits -= 16;
    }


    if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 ||
      windowBits < 8 || windowBits > 15 || level < 0 || level > 9 ||
      strategy < 0 || strategy > Z_FIXED$1) {
      return err(strm, Z_STREAM_ERROR$2);
    }


    if (windowBits === 8) {
      windowBits = 9;
    }
    /* until 256-byte window bug fixed */

    var s = new DeflateState();

    strm.state = s;
    s.strm = strm;

    s.wrap = wrap;
    s.gzhead = null;
    s.w_bits = windowBits;
    s.w_size = 1 << s.w_bits;
    s.w_mask = s.w_size - 1;

    s.hash_bits = memLevel + 7;
    s.hash_size = 1 << s.hash_bits;
    s.hash_mask = s.hash_size - 1;
    s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);

    s.window = new Buf8(s.w_size * 2);
    s.head = new Buf16(s.hash_size);
    s.prev = new Buf16(s.w_size);

    // Don't need mem init magic for JS.
    //s.high_water = 0;  /* nothing written to s->window yet */

    s.lit_bufsize = 1 << (memLevel + 6); /* 16K elements by default */

    s.pending_buf_size = s.lit_bufsize * 4;

    //overlay = (ushf *) ZALLOC(strm, s->lit_bufsize, sizeof(ush)+2);
    //s->pending_buf = (uchf *) overlay;
    s.pending_buf = new Buf8(s.pending_buf_size);

    // It is offset from `s.pending_buf` (size is `s.lit_bufsize * 2`)
    //s->d_buf = overlay + s->lit_bufsize/sizeof(ush);
    s.d_buf = 1 * s.lit_bufsize;

    //s->l_buf = s->pending_buf + (1+sizeof(ush))*s->lit_bufsize;
    s.l_buf = (1 + 2) * s.lit_bufsize;

    s.level = level;
    s.strategy = strategy;
    s.method = method;

    return deflateReset(strm);
  }


  function deflate$1(strm, flush) {
    var old_flush, s;
    var beg, val; // for gzip header write only

    if (!strm || !strm.state ||
      flush > Z_BLOCK$2 || flush < 0) {
      return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2;
    }

    s = strm.state;

    if (!strm.output ||
      (!strm.input && strm.avail_in !== 0) ||
      (s.status === FINISH_STATE && flush !== Z_FINISH$2)) {
      return err(strm, (strm.avail_out === 0) ? Z_BUF_ERROR$2 : Z_STREAM_ERROR$2);
    }

    s.strm = strm; /* just in case */
    old_flush = s.last_flush;
    s.last_flush = flush;

    /* Write the header */
    if (s.status === INIT_STATE) {
      if (s.wrap === 2) {
        // GZIP header
        strm.adler = 0; //crc32(0L, Z_NULL, 0);
        put_byte(s, 31);
        put_byte(s, 139);
        put_byte(s, 8);
        if (!s.gzhead) { // s->gzhead == Z_NULL
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, s.level === 9 ? 2 :
            (s.strategy >= Z_HUFFMAN_ONLY$1 || s.level < 2 ?
              4 : 0));
          put_byte(s, OS_CODE);
          s.status = BUSY_STATE;
        } else {
          put_byte(s, (s.gzhead.text ? 1 : 0) +
            (s.gzhead.hcrc ? 2 : 0) +
            (!s.gzhead.extra ? 0 : 4) +
            (!s.gzhead.name ? 0 : 8) +
            (!s.gzhead.comment ? 0 : 16)
          );
          put_byte(s, s.gzhead.time & 0xff);
          put_byte(s, (s.gzhead.time >> 8) & 0xff);
          put_byte(s, (s.gzhead.time >> 16) & 0xff);
          put_byte(s, (s.gzhead.time >> 24) & 0xff);
          put_byte(s, s.level === 9 ? 2 :
            (s.strategy >= Z_HUFFMAN_ONLY$1 || s.level < 2 ?
              4 : 0));
          put_byte(s, s.gzhead.os & 0xff);
          if (s.gzhead.extra && s.gzhead.extra.length) {
            put_byte(s, s.gzhead.extra.length & 0xff);
            put_byte(s, (s.gzhead.extra.length >> 8) & 0xff);
          }
          if (s.gzhead.hcrc) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
          }
          s.gzindex = 0;
          s.status = EXTRA_STATE;
        }
      } else // DEFLATE header
      {
        var header = (Z_DEFLATED$2 + ((s.w_bits - 8) << 4)) << 8;
        var level_flags = -1;

        if (s.strategy >= Z_HUFFMAN_ONLY$1 || s.level < 2) {
          level_flags = 0;
        } else if (s.level < 6) {
          level_flags = 1;
        } else if (s.level === 6) {
          level_flags = 2;
        } else {
          level_flags = 3;
        }
        header |= (level_flags << 6);
        if (s.strstart !== 0) {
          header |= PRESET_DICT;
        }
        header += 31 - (header % 31);

        s.status = BUSY_STATE;
        putShortMSB(s, header);

        /* Save the adler32 of the preset dictionary: */
        if (s.strstart !== 0) {
          putShortMSB(s, strm.adler >>> 16);
          putShortMSB(s, strm.adler & 0xffff);
        }
        strm.adler = 1; // adler32(0L, Z_NULL, 0);
      }
    }

    //#ifdef GZIP
    if (s.status === EXTRA_STATE) {
      if (s.gzhead.extra /* != Z_NULL*/ ) {
        beg = s.pending; /* start of bytes to update crc */

        while (s.gzindex < (s.gzhead.extra.length & 0xffff)) {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              break;
            }
          }
          put_byte(s, s.gzhead.extra[s.gzindex] & 0xff);
          s.gzindex++;
        }
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (s.gzindex === s.gzhead.extra.length) {
          s.gzindex = 0;
          s.status = NAME_STATE;
        }
      } else {
        s.status = NAME_STATE;
      }
    }
    if (s.status === NAME_STATE) {
      if (s.gzhead.name /* != Z_NULL*/ ) {
        beg = s.pending; /* start of bytes to update crc */
        //int val;

        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              val = 1;
              break;
            }
          }
          // JS specific: little magic to add zero terminator to end of string
          if (s.gzindex < s.gzhead.name.length) {
            val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);

        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (val === 0) {
          s.gzindex = 0;
          s.status = COMMENT_STATE;
        }
      } else {
        s.status = COMMENT_STATE;
      }
    }
    if (s.status === COMMENT_STATE) {
      if (s.gzhead.comment /* != Z_NULL*/ ) {
        beg = s.pending; /* start of bytes to update crc */
        //int val;

        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              val = 1;
              break;
            }
          }
          // JS specific: little magic to add zero terminator to end of string
          if (s.gzindex < s.gzhead.comment.length) {
            val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);

        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (val === 0) {
          s.status = HCRC_STATE;
        }
      } else {
        s.status = HCRC_STATE;
      }
    }
    if (s.status === HCRC_STATE) {
      if (s.gzhead.hcrc) {
        if (s.pending + 2 > s.pending_buf_size) {
          flush_pending(strm);
        }
        if (s.pending + 2 <= s.pending_buf_size) {
          put_byte(s, strm.adler & 0xff);
          put_byte(s, (strm.adler >> 8) & 0xff);
          strm.adler = 0; //crc32(0L, Z_NULL, 0);
          s.status = BUSY_STATE;
        }
      } else {
        s.status = BUSY_STATE;
      }
    }
    //#endif

    /* Flush as much pending output as possible */
    if (s.pending !== 0) {
      flush_pending(strm);
      if (strm.avail_out === 0) {
        /* Since avail_out is 0, deflate will be called again with
         * more output space, but possibly with both pending and
         * avail_in equal to zero. There won't be anything to do,
         * but this is not an error situation so make sure we
         * return OK instead of BUF_ERROR at next call of deflate:
         */
        s.last_flush = -1;
        return Z_OK$2;
      }

      /* Make sure there is something to do and avoid duplicate consecutive
       * flushes. For repeated and useless calls with Z_FINISH, we keep
       * returning Z_STREAM_END instead of Z_BUF_ERROR.
       */
    } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) &&
      flush !== Z_FINISH$2) {
      return err(strm, Z_BUF_ERROR$2);
    }

    /* User must not provide more input after the first FINISH: */
    if (s.status === FINISH_STATE && strm.avail_in !== 0) {
      return err(strm, Z_BUF_ERROR$2);
    }

    /* Start a new block or continue the current one.
     */
    if (strm.avail_in !== 0 || s.lookahead !== 0 ||
      (flush !== Z_NO_FLUSH$1 && s.status !== FINISH_STATE)) {
      var bstate = (s.strategy === Z_HUFFMAN_ONLY$1) ? deflate_huff(s, flush) :
        (s.strategy === Z_RLE$1 ? deflate_rle(s, flush) :
          configuration_table[s.level].func(s, flush));

      if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
        s.status = FINISH_STATE;
      }
      if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
        if (strm.avail_out === 0) {
          s.last_flush = -1;
          /* avoid BUF_ERROR next call, see above */
        }
        return Z_OK$2;
        /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
         * of deflate should use the same flush parameter to make sure
         * that the flush is complete. So we don't have to output an
         * empty block here, this will be done at next call. This also
         * ensures that for a very small output buffer, we emit at most
         * one empty block.
         */
      }
      if (bstate === BS_BLOCK_DONE) {
        if (flush === Z_PARTIAL_FLUSH$1) {
          _tr_align(s);
        } else if (flush !== Z_BLOCK$2) { /* FULL_FLUSH or SYNC_FLUSH */

          _tr_stored_block(s, 0, 0, false);
          /* For a full flush, this empty block will be recognized
           * as a special marker by inflate_sync().
           */
          if (flush === Z_FULL_FLUSH$1) {
            /*** CLEAR_HASH(s); ***/
            /* forget history */
            zero(s.head); // Fill with NIL (= 0);

            if (s.lookahead === 0) {
              s.strstart = 0;
              s.block_start = 0;
              s.insert = 0;
            }
          }
        }
        flush_pending(strm);
        if (strm.avail_out === 0) {
          s.last_flush = -1; /* avoid BUF_ERROR at next call, see above */
          return Z_OK$2;
        }
      }
    }
    //Assert(strm->avail_out > 0, "bug2");
    //if (strm.avail_out <= 0) { throw new Error("bug2");}

    if (flush !== Z_FINISH$2) {
      return Z_OK$2;
    }
    if (s.wrap <= 0) {
      return Z_STREAM_END$2;
    }

    /* Write the trailer */
    if (s.wrap === 2) {
      put_byte(s, strm.adler & 0xff);
      put_byte(s, (strm.adler >> 8) & 0xff);
      put_byte(s, (strm.adler >> 16) & 0xff);
      put_byte(s, (strm.adler >> 24) & 0xff);
      put_byte(s, strm.total_in & 0xff);
      put_byte(s, (strm.total_in >> 8) & 0xff);
      put_byte(s, (strm.total_in >> 16) & 0xff);
      put_byte(s, (strm.total_in >> 24) & 0xff);
    } else {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 0xffff);
    }

    flush_pending(strm);
    /* If avail_out is zero, the application will call deflate again
     * to flush the rest.
     */
    if (s.wrap > 0) {
      s.wrap = -s.wrap;
    }
    /* write the trailer only once! */
    return s.pending !== 0 ? Z_OK$2 : Z_STREAM_END$2;
  }

  function deflateEnd(strm) {
    var status;

    if (!strm /*== Z_NULL*/ || !strm.state /*== Z_NULL*/ ) {
      return Z_STREAM_ERROR$2;
    }

    status = strm.state.status;
    if (status !== INIT_STATE &&
      status !== EXTRA_STATE &&
      status !== NAME_STATE &&
      status !== COMMENT_STATE &&
      status !== HCRC_STATE &&
      status !== BUSY_STATE &&
      status !== FINISH_STATE
    ) {
      return err(strm, Z_STREAM_ERROR$2);
    }

    strm.state = null;

    return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$2;
  }

  /* Not implemented
  exports.deflateBound = deflateBound;
  exports.deflateCopy = deflateCopy;
  exports.deflateParams = deflateParams;
  exports.deflatePending = deflatePending;
  exports.deflatePrime = deflatePrime;
  exports.deflateTune = deflateTune;
  */

  // See state defs from inflate.js
  var BAD$1 = 30;       /* got a data error -- remain here until reset */
  var TYPE$1 = 12;      /* i: waiting for type bits, including last-flag bit */

  /*
     Decode literal, length, and distance codes and write out the resulting
     literal and match bytes until either not enough input or output is
     available, an end-of-block is encountered, or a data error is encountered.
     When large enough input and output buffers are supplied to inflate(), for
     example, a 16K input buffer and a 64K output buffer, more than 95% of the
     inflate execution time is spent in this routine.

     Entry assumptions:

          state.mode === LEN
          strm.avail_in >= 6
          strm.avail_out >= 258
          start >= strm.avail_out
          state.bits < 8

     On return, state.mode is one of:

          LEN -- ran out of enough output space or enough available input
          TYPE -- reached end of block code, inflate() to interpret next block
          BAD -- error in block data

     Notes:

      - The maximum input bits used by a length/distance pair is 15 bits for the
        length code, 5 bits for the length extra, 15 bits for the distance code,
        and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
        Therefore if strm.avail_in >= 6, then there is enough input to avoid
        checking for available input while decoding.

      - The maximum bytes that a single length/distance pair can output is 258
        bytes, which is the maximum length that can be coded.  inflate_fast()
        requires strm.avail_out >= 258 for each loop to avoid checking for
        output space.
   */
  function inflate_fast(strm, start) {
    var state;
    var _in;                    /* local strm.input */
    var last;                   /* have enough input while in < last */
    var _out;                   /* local strm.output */
    var beg;                    /* inflate()'s initial strm.output */
    var end;                    /* while out < end, enough space available */
  //#ifdef INFLATE_STRICT
    var dmax;                   /* maximum distance from zlib header */
  //#endif
    var wsize;                  /* window size or zero if not using window */
    var whave;                  /* valid bytes in the window */
    var wnext;                  /* window write index */
    // Use `s_window` instead `window`, avoid conflict with instrumentation tools
    var s_window;               /* allocated sliding window, if wsize != 0 */
    var hold;                   /* local strm.hold */
    var bits;                   /* local strm.bits */
    var lcode;                  /* local strm.lencode */
    var dcode;                  /* local strm.distcode */
    var lmask;                  /* mask for first level of length codes */
    var dmask;                  /* mask for first level of distance codes */
    var here;                   /* retrieved table entry */
    var op;                     /* code bits, operation, extra bits, or */
                                /*  window position, window bytes to copy */
    var len;                    /* match length, unused bytes */
    var dist;                   /* match distance */
    var from;                   /* where to copy match from */
    var from_source;


    var input, output; // JS specific, because we have no pointers

    /* copy state to local variables */
    state = strm.state;
    //here = state.here;
    _in = strm.next_in;
    input = strm.input;
    last = _in + (strm.avail_in - 5);
    _out = strm.next_out;
    output = strm.output;
    beg = _out - (start - strm.avail_out);
    end = _out + (strm.avail_out - 257);
  //#ifdef INFLATE_STRICT
    dmax = state.dmax;
  //#endif
    wsize = state.wsize;
    whave = state.whave;
    wnext = state.wnext;
    s_window = state.window;
    hold = state.hold;
    bits = state.bits;
    lcode = state.lencode;
    dcode = state.distcode;
    lmask = (1 << state.lenbits) - 1;
    dmask = (1 << state.distbits) - 1;


    /* decode literals and length/distances until end-of-block or not enough
       input data or output space */

    top:
    do {
      if (bits < 15) {
        hold += input[_in++] << bits;
        bits += 8;
        hold += input[_in++] << bits;
        bits += 8;
      }

      here = lcode[hold & lmask];

      dolen:
      for (;;) { // Goto emulation
        op = here >>> 24/*here.bits*/;
        hold >>>= op;
        bits -= op;
        op = (here >>> 16) & 0xff/*here.op*/;
        if (op === 0) {                          /* literal */
          //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
          //        "inflate:         literal '%c'\n" :
          //        "inflate:         literal 0x%02x\n", here.val));
          output[_out++] = here & 0xffff/*here.val*/;
        }
        else if (op & 16) {                     /* length base */
          len = here & 0xffff/*here.val*/;
          op &= 15;                           /* number of extra bits */
          if (op) {
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
            }
            len += hold & ((1 << op) - 1);
            hold >>>= op;
            bits -= op;
          }
          //Tracevv((stderr, "inflate:         length %u\n", len));
          if (bits < 15) {
            hold += input[_in++] << bits;
            bits += 8;
            hold += input[_in++] << bits;
            bits += 8;
          }
          here = dcode[hold & dmask];

          dodist:
          for (;;) { // goto emulation
            op = here >>> 24/*here.bits*/;
            hold >>>= op;
            bits -= op;
            op = (here >>> 16) & 0xff/*here.op*/;

            if (op & 16) {                      /* distance base */
              dist = here & 0xffff/*here.val*/;
              op &= 15;                       /* number of extra bits */
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
                if (bits < op) {
                  hold += input[_in++] << bits;
                  bits += 8;
                }
              }
              dist += hold & ((1 << op) - 1);
  //#ifdef INFLATE_STRICT
              if (dist > dmax) {
                strm.msg = 'invalid distance too far back';
                state.mode = BAD$1;
                break top;
              }
  //#endif
              hold >>>= op;
              bits -= op;
              //Tracevv((stderr, "inflate:         distance %u\n", dist));
              op = _out - beg;                /* max distance in output */
              if (dist > op) {                /* see if copy from window */
                op = dist - op;               /* distance back in window */
                if (op > whave) {
                  if (state.sane) {
                    strm.msg = 'invalid distance too far back';
                    state.mode = BAD$1;
                    break top;
                  }

  // (!) This block is disabled in zlib defailts,
  // don't enable it for binary compatibility
  //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
  //                if (len <= op - whave) {
  //                  do {
  //                    output[_out++] = 0;
  //                  } while (--len);
  //                  continue top;
  //                }
  //                len -= op - whave;
  //                do {
  //                  output[_out++] = 0;
  //                } while (--op > whave);
  //                if (op === 0) {
  //                  from = _out - dist;
  //                  do {
  //                    output[_out++] = output[from++];
  //                  } while (--len);
  //                  continue top;
  //                }
  //#endif
                }
                from = 0; // window index
                from_source = s_window;
                if (wnext === 0) {           /* very common case */
                  from += wsize - op;
                  if (op < len) {         /* some from window */
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist;  /* rest from output */
                    from_source = output;
                  }
                }
                else if (wnext < op) {      /* wrap around window */
                  from += wsize + wnext - op;
                  op -= wnext;
                  if (op < len) {         /* some from end of window */
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = 0;
                    if (wnext < len) {  /* some from start of window */
                      op = wnext;
                      len -= op;
                      do {
                        output[_out++] = s_window[from++];
                      } while (--op);
                      from = _out - dist;      /* rest from output */
                      from_source = output;
                    }
                  }
                }
                else {                      /* contiguous in window */
                  from += wnext - op;
                  if (op < len) {         /* some from window */
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist;  /* rest from output */
                    from_source = output;
                  }
                }
                while (len > 2) {
                  output[_out++] = from_source[from++];
                  output[_out++] = from_source[from++];
                  output[_out++] = from_source[from++];
                  len -= 3;
                }
                if (len) {
                  output[_out++] = from_source[from++];
                  if (len > 1) {
                    output[_out++] = from_source[from++];
                  }
                }
              }
              else {
                from = _out - dist;          /* copy direct from output */
                do {                        /* minimum length is three */
                  output[_out++] = output[from++];
                  output[_out++] = output[from++];
                  output[_out++] = output[from++];
                  len -= 3;
                } while (len > 2);
                if (len) {
                  output[_out++] = output[from++];
                  if (len > 1) {
                    output[_out++] = output[from++];
                  }
                }
              }
            }
            else if ((op & 64) === 0) {          /* 2nd level distance code */
              here = dcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
              continue dodist;
            }
            else {
              strm.msg = 'invalid distance code';
              state.mode = BAD$1;
              break top;
            }

            break; // need to emulate goto via "continue"
          }
        }
        else if ((op & 64) === 0) {              /* 2nd level length code */
          here = lcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
          continue dolen;
        }
        else if (op & 32) {                     /* end-of-block */
          //Tracevv((stderr, "inflate:         end of block\n"));
          state.mode = TYPE$1;
          break top;
        }
        else {
          strm.msg = 'invalid literal/length code';
          state.mode = BAD$1;
          break top;
        }

        break; // need to emulate goto via "continue"
      }
    } while (_in < last && _out < end);

    /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
    len = bits >> 3;
    _in -= len;
    bits -= len << 3;
    hold &= (1 << bits) - 1;

    /* update state and return */
    strm.next_in = _in;
    strm.next_out = _out;
    strm.avail_in = (_in < last ? 5 + (last - _in) : 5 - (_in - last));
    strm.avail_out = (_out < end ? 257 + (end - _out) : 257 - (_out - end));
    state.hold = hold;
    state.bits = bits;
    return;
  }

  var MAXBITS = 15;
  var ENOUGH_LENS$1 = 852;
  var ENOUGH_DISTS$1 = 592;
  //var ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

  var CODES$1 = 0;
  var LENS$1 = 1;
  var DISTS$1 = 2;

  var lbase = [ /* Length codes 257..285 base */
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
  ];

  var lext = [ /* Length codes 257..285 extra */
    16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18,
    19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78
  ];

  var dbase = [ /* Distance codes 0..29 base */
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
    8193, 12289, 16385, 24577, 0, 0
  ];

  var dext = [ /* Distance codes 0..29 extra */
    16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22,
    23, 23, 24, 24, 25, 25, 26, 26, 27, 27,
    28, 28, 29, 29, 64, 64
  ];

  function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts) {
    var bits = opts.bits;
    //here = opts.here; /* table entry for duplication */

    var len = 0; /* a code's length in bits */
    var sym = 0; /* index of code symbols */
    var min = 0,
      max = 0; /* minimum and maximum code lengths */
    var root = 0; /* number of index bits for root table */
    var curr = 0; /* number of index bits for current table */
    var drop = 0; /* code bits to drop for sub-table */
    var left = 0; /* number of prefix codes available */
    var used = 0; /* code entries in table used */
    var huff = 0; /* Huffman code */
    var incr; /* for incrementing code, index */
    var fill; /* index for replicating entries */
    var low; /* low bits for current root entry */
    var mask; /* mask for low root bits */
    var next; /* next available space in table */
    var base = null; /* base value table to use */
    var base_index = 0;
    //  var shoextra;    /* extra bits table to use */
    var end; /* use base and extra for symbol > end */
    var count = new Buf16(MAXBITS + 1); //[MAXBITS+1];    /* number of codes of each length */
    var offs = new Buf16(MAXBITS + 1); //[MAXBITS+1];     /* offsets in table for each length */
    var extra = null;
    var extra_index = 0;

    var here_bits, here_op, here_val;

    /*
     Process a set of code lengths to create a canonical Huffman code.  The
     code lengths are lens[0..codes-1].  Each length corresponds to the
     symbols 0..codes-1.  The Huffman code is generated by first sorting the
     symbols by length from short to long, and retaining the symbol order
     for codes with equal lengths.  Then the code starts with all zero bits
     for the first code of the shortest length, and the codes are integer
     increments for the same length, and zeros are appended as the length
     increases.  For the deflate format, these bits are stored backwards
     from their more natural integer increment ordering, and so when the
     decoding tables are built in the large loop below, the integer codes
     are incremented backwards.

     This routine assumes, but does not check, that all of the entries in
     lens[] are in the range 0..MAXBITS.  The caller must assure this.
     1..MAXBITS is interpreted as that code length.  zero means that that
     symbol does not occur in this code.

     The codes are sorted by computing a count of codes for each length,
     creating from that a table of starting indices for each length in the
     sorted table, and then entering the symbols in order in the sorted
     table.  The sorted table is work[], with that space being provided by
     the caller.

     The length counts are used for other purposes as well, i.e. finding
     the minimum and maximum length codes, determining if there are any
     codes at all, checking for a valid set of lengths, and looking ahead
     at length counts to determine sub-table sizes when building the
     decoding tables.
     */

    /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
    for (len = 0; len <= MAXBITS; len++) {
      count[len] = 0;
    }
    for (sym = 0; sym < codes; sym++) {
      count[lens[lens_index + sym]]++;
    }

    /* bound code lengths, force root to be within code lengths */
    root = bits;
    for (max = MAXBITS; max >= 1; max--) {
      if (count[max] !== 0) {
        break;
      }
    }
    if (root > max) {
      root = max;
    }
    if (max === 0) { /* no symbols to code at all */
      //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
      //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
      //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
      table[table_index++] = (1 << 24) | (64 << 16) | 0;


      //table.op[opts.table_index] = 64;
      //table.bits[opts.table_index] = 1;
      //table.val[opts.table_index++] = 0;
      table[table_index++] = (1 << 24) | (64 << 16) | 0;

      opts.bits = 1;
      return 0; /* no symbols, but wait for decoding to report error */
    }
    for (min = 1; min < max; min++) {
      if (count[min] !== 0) {
        break;
      }
    }
    if (root < min) {
      root = min;
    }

    /* check for an over-subscribed or incomplete set of lengths */
    left = 1;
    for (len = 1; len <= MAXBITS; len++) {
      left <<= 1;
      left -= count[len];
      if (left < 0) {
        return -1;
      } /* over-subscribed */
    }
    if (left > 0 && (type === CODES$1 || max !== 1)) {
      return -1; /* incomplete set */
    }

    /* generate offsets into symbol table for each length for sorting */
    offs[1] = 0;
    for (len = 1; len < MAXBITS; len++) {
      offs[len + 1] = offs[len] + count[len];
    }

    /* sort symbols by length, by symbol order within each length */
    for (sym = 0; sym < codes; sym++) {
      if (lens[lens_index + sym] !== 0) {
        work[offs[lens[lens_index + sym]]++] = sym;
      }
    }

    /*
     Create and fill in decoding tables.  In this loop, the table being
     filled is at next and has curr index bits.  The code being used is huff
     with length len.  That code is converted to an index by dropping drop
     bits off of the bottom.  For codes where len is less than drop + curr,
     those top drop + curr - len bits are incremented through all values to
     fill the table with replicated entries.

     root is the number of index bits for the root table.  When len exceeds
     root, sub-tables are created pointed to by the root entry with an index
     of the low root bits of huff.  This is saved in low to check for when a
     new sub-table should be started.  drop is zero when the root table is
     being filled, and drop is root when sub-tables are being filled.

     When a new sub-table is needed, it is necessary to look ahead in the
     code lengths to determine what size sub-table is needed.  The length
     counts are used for this, and so count[] is decremented as codes are
     entered in the tables.

     used keeps track of how many table entries have been allocated from the
     provided *table space.  It is checked for LENS and DIST tables against
     the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
     the initial root table size constants.  See the comments in inftrees.h
     for more information.

     sym increments through all symbols, and the loop terminates when
     all codes of length max, i.e. all codes, have been processed.  This
     routine permits incomplete codes, so another loop after this one fills
     in the rest of the decoding tables with invalid code markers.
     */

    /* set up for code type */
    // poor man optimization - use if-else instead of switch,
    // to avoid deopts in old v8
    if (type === CODES$1) {
      base = extra = work; /* dummy value--not used */
      end = 19;

    } else if (type === LENS$1) {
      base = lbase;
      base_index -= 257;
      extra = lext;
      extra_index -= 257;
      end = 256;

    } else { /* DISTS */
      base = dbase;
      extra = dext;
      end = -1;
    }

    /* initialize opts for loop */
    huff = 0; /* starting code */
    sym = 0; /* starting code symbol */
    len = min; /* starting code length */
    next = table_index; /* current table to fill in */
    curr = root; /* current table index bits */
    drop = 0; /* current bits to drop from code for index */
    low = -1; /* trigger new sub-table when len > root */
    used = 1 << root; /* use root table entries */
    mask = used - 1; /* mask for comparing low */

    /* check available table space */
    if ((type === LENS$1 && used > ENOUGH_LENS$1) ||
      (type === DISTS$1 && used > ENOUGH_DISTS$1)) {
      return 1;
    }
    /* process all codes and make table entries */
    for (;;) {
      /* create table entry */
      here_bits = len - drop;
      if (work[sym] < end) {
        here_op = 0;
        here_val = work[sym];
      } else if (work[sym] > end) {
        here_op = extra[extra_index + work[sym]];
        here_val = base[base_index + work[sym]];
      } else {
        here_op = 32 + 64; /* end of block */
        here_val = 0;
      }

      /* replicate for those indices with low len bits equal to huff */
      incr = 1 << (len - drop);
      fill = 1 << curr;
      min = fill; /* save offset to next table */
      do {
        fill -= incr;
        table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val | 0;
      } while (fill !== 0);

      /* backwards increment the len-bit code huff */
      incr = 1 << (len - 1);
      while (huff & incr) {
        incr >>= 1;
      }
      if (incr !== 0) {
        huff &= incr - 1;
        huff += incr;
      } else {
        huff = 0;
      }

      /* go to next symbol, update count, len */
      sym++;
      if (--count[len] === 0) {
        if (len === max) {
          break;
        }
        len = lens[lens_index + work[sym]];
      }

      /* create new sub-table if needed */
      if (len > root && (huff & mask) !== low) {
        /* if first time, transition to sub-tables */
        if (drop === 0) {
          drop = root;
        }

        /* increment past last table */
        next += min; /* here min is 1 << curr */

        /* determine length of next table */
        curr = len - drop;
        left = 1 << curr;
        while (curr + drop < max) {
          left -= count[curr + drop];
          if (left <= 0) {
            break;
          }
          curr++;
          left <<= 1;
        }

        /* check for enough space */
        used += 1 << curr;
        if ((type === LENS$1 && used > ENOUGH_LENS$1) ||
          (type === DISTS$1 && used > ENOUGH_DISTS$1)) {
          return 1;
        }

        /* point entry in root table to sub-table */
        low = huff & mask;
        /*table.op[low] = curr;
        table.bits[low] = root;
        table.val[low] = next - opts.table_index;*/
        table[low] = (root << 24) | (curr << 16) | (next - table_index) | 0;
      }
    }

    /* fill in remaining table entry if code is incomplete (guaranteed to have
     at most one remaining entry, since if the code is incomplete, the
     maximum code length that was allowed to get this far is one bit) */
    if (huff !== 0) {
      //table.op[next + huff] = 64;            /* invalid code marker */
      //table.bits[next + huff] = len - drop;
      //table.val[next + huff] = 0;
      table[next + huff] = ((len - drop) << 24) | (64 << 16) | 0;
    }

    /* set return parameters */
    //opts.table_index += used;
    opts.bits = root;
    return 0;
  }

  var CODES = 0;
  var LENS = 1;
  var DISTS = 2;

  /* Public constants ==========================================================*/
  /* ===========================================================================*/


  /* Allowed flush values; see deflate() and inflate() below for details */
  //var Z_NO_FLUSH      = 0;
  //var Z_PARTIAL_FLUSH = 1;
  //var Z_SYNC_FLUSH    = 2;
  //var Z_FULL_FLUSH    = 3;
  var Z_FINISH$1 = 4;
  var Z_BLOCK$1 = 5;
  var Z_TREES$1 = 6;


  /* Return codes for the compression/decompression functions. Negative values
   * are errors, positive values are used for special but normal events.
   */
  var Z_OK$1 = 0;
  var Z_STREAM_END$1 = 1;
  var Z_NEED_DICT$1 = 2;
  //var Z_ERRNO         = -1;
  var Z_STREAM_ERROR$1 = -2;
  var Z_DATA_ERROR$1 = -3;
  var Z_MEM_ERROR = -4;
  var Z_BUF_ERROR$1 = -5;
  //var Z_VERSION_ERROR = -6;

  /* The deflate compression method */
  var Z_DEFLATED$1 = 8;


  /* STATES ====================================================================*/
  /* ===========================================================================*/


  var HEAD = 1; /* i: waiting for magic header */
  var FLAGS = 2; /* i: waiting for method and flags (gzip) */
  var TIME = 3; /* i: waiting for modification time (gzip) */
  var OS = 4; /* i: waiting for extra flags and operating system (gzip) */
  var EXLEN = 5; /* i: waiting for extra length (gzip) */
  var EXTRA = 6; /* i: waiting for extra bytes (gzip) */
  var NAME = 7; /* i: waiting for end of file name (gzip) */
  var COMMENT = 8; /* i: waiting for end of comment (gzip) */
  var HCRC = 9; /* i: waiting for header crc (gzip) */
  var DICTID = 10; /* i: waiting for dictionary check value */
  var DICT = 11; /* waiting for inflateSetDictionary() call */
  var TYPE = 12; /* i: waiting for type bits, including last-flag bit */
  var TYPEDO = 13; /* i: same, but skip check to exit inflate on new block */
  var STORED = 14; /* i: waiting for stored size (length and complement) */
  var COPY_ = 15; /* i/o: same as COPY below, but only first time in */
  var COPY = 16; /* i/o: waiting for input or output to copy stored block */
  var TABLE = 17; /* i: waiting for dynamic block table lengths */
  var LENLENS = 18; /* i: waiting for code length code lengths */
  var CODELENS = 19; /* i: waiting for length/lit and distance code lengths */
  var LEN_ = 20; /* i: same as LEN below, but only first time in */
  var LEN = 21; /* i: waiting for length/lit/eob code */
  var LENEXT = 22; /* i: waiting for length extra bits */
  var DIST = 23; /* i: waiting for distance code */
  var DISTEXT = 24; /* i: waiting for distance extra bits */
  var MATCH = 25; /* o: waiting for output space to copy string */
  var LIT = 26; /* o: waiting for output space to write literal */
  var CHECK = 27; /* i: waiting for 32-bit check value */
  var LENGTH = 28; /* i: waiting for 32-bit length (gzip) */
  var DONE = 29; /* finished check, done -- remain here until reset */
  var BAD = 30; /* got a data error -- remain here until reset */
  var MEM = 31; /* got an inflate() memory error -- remain here until reset */
  var SYNC = 32; /* looking for synchronization bytes to restart inflate() */

  /* ===========================================================================*/



  var ENOUGH_LENS = 852;
  var ENOUGH_DISTS = 592;


  function zswap32(q) {
    return (((q >>> 24) & 0xff) +
      ((q >>> 8) & 0xff00) +
      ((q & 0xff00) << 8) +
      ((q & 0xff) << 24));
  }


  function InflateState() {
    this.mode = 0; /* current inflate mode */
    this.last = false; /* true if processing last block */
    this.wrap = 0; /* bit 0 true for zlib, bit 1 true for gzip */
    this.havedict = false; /* true if dictionary provided */
    this.flags = 0; /* gzip header method and flags (0 if zlib) */
    this.dmax = 0; /* zlib header max distance (INFLATE_STRICT) */
    this.check = 0; /* protected copy of check value */
    this.total = 0; /* protected copy of output count */
    // TODO: may be {}
    this.head = null; /* where to save gzip header information */

    /* sliding window */
    this.wbits = 0; /* log base 2 of requested window size */
    this.wsize = 0; /* window size or zero if not using window */
    this.whave = 0; /* valid bytes in the window */
    this.wnext = 0; /* window write index */
    this.window = null; /* allocated sliding window, if needed */

    /* bit accumulator */
    this.hold = 0; /* input bit accumulator */
    this.bits = 0; /* number of bits in "in" */

    /* for string and stored block copying */
    this.length = 0; /* literal or length of data to copy */
    this.offset = 0; /* distance back to copy string from */

    /* for table and code decoding */
    this.extra = 0; /* extra bits needed */

    /* fixed and dynamic code tables */
    this.lencode = null; /* starting table for length/literal codes */
    this.distcode = null; /* starting table for distance codes */
    this.lenbits = 0; /* index bits for lencode */
    this.distbits = 0; /* index bits for distcode */

    /* dynamic table building */
    this.ncode = 0; /* number of code length code lengths */
    this.nlen = 0; /* number of length code lengths */
    this.ndist = 0; /* number of distance code lengths */
    this.have = 0; /* number of code lengths in lens[] */
    this.next = null; /* next available space in codes[] */

    this.lens = new Buf16(320); /* temporary storage for code lengths */
    this.work = new Buf16(288); /* work area for code table building */

    /*
     because we don't have pointers in js, we use lencode and distcode directly
     as buffers so we don't need codes
    */
    //this.codes = new Buf32(ENOUGH);       /* space for code tables */
    this.lendyn = null; /* dynamic table for length/literal codes (JS specific) */
    this.distdyn = null; /* dynamic table for distance codes (JS specific) */
    this.sane = 0; /* if false, allow invalid distance too far */
    this.back = 0; /* bits back of last unprocessed length/lit */
    this.was = 0; /* initial length of match */
  }

  function inflateResetKeep(strm) {
    var state;

    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$1;
    }
    state = strm.state;
    strm.total_in = strm.total_out = state.total = 0;
    strm.msg = ''; /*Z_NULL*/
    if (state.wrap) { /* to support ill-conceived Java test suite */
      strm.adler = state.wrap & 1;
    }
    state.mode = HEAD;
    state.last = 0;
    state.havedict = 0;
    state.dmax = 32768;
    state.head = null /*Z_NULL*/ ;
    state.hold = 0;
    state.bits = 0;
    //state.lencode = state.distcode = state.next = state.codes;
    state.lencode = state.lendyn = new Buf32(ENOUGH_LENS);
    state.distcode = state.distdyn = new Buf32(ENOUGH_DISTS);

    state.sane = 1;
    state.back = -1;
    //Tracev((stderr, "inflate: reset\n"));
    return Z_OK$1;
  }

  function inflateReset(strm) {
    var state;

    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$1;
    }
    state = strm.state;
    state.wsize = 0;
    state.whave = 0;
    state.wnext = 0;
    return inflateResetKeep(strm);

  }

  function inflateReset2(strm, windowBits) {
    var wrap;
    var state;

    /* get the state */
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$1;
    }
    state = strm.state;

    /* extract wrap request from windowBits parameter */
    if (windowBits < 0) {
      wrap = 0;
      windowBits = -windowBits;
    } else {
      wrap = (windowBits >> 4) + 1;
      if (windowBits < 48) {
        windowBits &= 15;
      }
    }

    /* set number of window bits, free window if different */
    if (windowBits && (windowBits < 8 || windowBits > 15)) {
      return Z_STREAM_ERROR$1;
    }
    if (state.window !== null && state.wbits !== windowBits) {
      state.window = null;
    }

    /* update state and reset the rest of it */
    state.wrap = wrap;
    state.wbits = windowBits;
    return inflateReset(strm);
  }

  function inflateInit2(strm, windowBits) {
    var ret;
    var state;

    if (!strm) {
      return Z_STREAM_ERROR$1;
    }
    //strm.msg = Z_NULL;                 /* in case we return an error */

    state = new InflateState();

    //if (state === Z_NULL) return Z_MEM_ERROR;
    //Tracev((stderr, "inflate: allocated\n"));
    strm.state = state;
    state.window = null /*Z_NULL*/ ;
    ret = inflateReset2(strm, windowBits);
    if (ret !== Z_OK$1) {
      strm.state = null /*Z_NULL*/ ;
    }
    return ret;
  }


  /*
   Return state with length and distance decoding tables and index sizes set to
   fixed code decoding.  Normally this returns fixed tables from inffixed.h.
   If BUILDFIXED is defined, then instead this routine builds the tables the
   first time it's called, and returns those tables the first time and
   thereafter.  This reduces the size of the code by about 2K bytes, in
   exchange for a little execution time.  However, BUILDFIXED should not be
   used for threaded applications, since the rewriting of the tables and virgin
   may not be thread-safe.
   */
  var virgin = true;

  var lenfix, distfix; // We have no pointers in JS, so keep tables separate

  function fixedtables(state) {
    /* build fixed huffman tables if first call (may not be thread safe) */
    if (virgin) {
      var sym;

      lenfix = new Buf32(512);
      distfix = new Buf32(32);

      /* literal/length table */
      sym = 0;
      while (sym < 144) {
        state.lens[sym++] = 8;
      }
      while (sym < 256) {
        state.lens[sym++] = 9;
      }
      while (sym < 280) {
        state.lens[sym++] = 7;
      }
      while (sym < 288) {
        state.lens[sym++] = 8;
      }

      inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, {
        bits: 9
      });

      /* distance table */
      sym = 0;
      while (sym < 32) {
        state.lens[sym++] = 5;
      }

      inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, {
        bits: 5
      });

      /* do this just once */
      virgin = false;
    }

    state.lencode = lenfix;
    state.lenbits = 9;
    state.distcode = distfix;
    state.distbits = 5;
  }


  /*
   Update the window with the last wsize (normally 32K) bytes written before
   returning.  If window does not exist yet, create it.  This is only called
   when a window is already in use, or when output has been written during this
   inflate call, but the end of the deflate stream has not been reached yet.
   It is also called to create a window for dictionary data when a dictionary
   is loaded.

   Providing output buffers larger than 32K to inflate() should provide a speed
   advantage, since only the last 32K of output is copied to the sliding window
   upon return from inflate(), and since all distances after the first 32K of
   output will fall in the output data, making match copies simpler and faster.
   The advantage may be dependent on the size of the processor's data caches.
   */
  function updatewindow(strm, src, end, copy) {
    var dist;
    var state = strm.state;

    /* if it hasn't been done already, allocate space for the window */
    if (state.window === null) {
      state.wsize = 1 << state.wbits;
      state.wnext = 0;
      state.whave = 0;

      state.window = new Buf8(state.wsize);
    }

    /* copy state->wsize or less output bytes into the circular window */
    if (copy >= state.wsize) {
      arraySet(state.window, src, end - state.wsize, state.wsize, 0);
      state.wnext = 0;
      state.whave = state.wsize;
    } else {
      dist = state.wsize - state.wnext;
      if (dist > copy) {
        dist = copy;
      }
      //zmemcpy(state->window + state->wnext, end - copy, dist);
      arraySet(state.window, src, end - copy, dist, state.wnext);
      copy -= dist;
      if (copy) {
        //zmemcpy(state->window, end - copy, copy);
        arraySet(state.window, src, end - copy, copy, 0);
        state.wnext = copy;
        state.whave = state.wsize;
      } else {
        state.wnext += dist;
        if (state.wnext === state.wsize) {
          state.wnext = 0;
        }
        if (state.whave < state.wsize) {
          state.whave += dist;
        }
      }
    }
    return 0;
  }

  function inflate$1(strm, flush) {
    var state;
    var input, output; // input/output buffers
    var next; /* next input INDEX */
    var put; /* next output INDEX */
    var have, left; /* available input and output */
    var hold; /* bit buffer */
    var bits; /* bits in bit buffer */
    var _in, _out; /* save starting available input and output */
    var copy; /* number of stored or match bytes to copy */
    var from; /* where to copy match bytes from */
    var from_source;
    var here = 0; /* current decoding table entry */
    var here_bits, here_op, here_val; // paked "here" denormalized (JS specific)
    //var last;                   /* parent table entry */
    var last_bits, last_op, last_val; // paked "last" denormalized (JS specific)
    var len; /* length to copy for repeats, bits to drop */
    var ret; /* return code */
    var hbuf = new Buf8(4); /* buffer for gzip header crc calculation */
    var opts;

    var n; // temporary var for NEED_BITS

    var order = /* permutation of code lengths */ [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];


    if (!strm || !strm.state || !strm.output ||
      (!strm.input && strm.avail_in !== 0)) {
      return Z_STREAM_ERROR$1;
    }

    state = strm.state;
    if (state.mode === TYPE) {
      state.mode = TYPEDO;
    } /* skip check */


    //--- LOAD() ---
    put = strm.next_out;
    output = strm.output;
    left = strm.avail_out;
    next = strm.next_in;
    input = strm.input;
    have = strm.avail_in;
    hold = state.hold;
    bits = state.bits;
    //---

    _in = have;
    _out = left;
    ret = Z_OK$1;

    inf_leave: // goto emulation
      for (;;) {
        switch (state.mode) {
        case HEAD:
          if (state.wrap === 0) {
            state.mode = TYPEDO;
            break;
          }
          //=== NEEDBITS(16);
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if ((state.wrap & 2) && hold === 0x8b1f) { /* gzip header */
            state.check = 0 /*crc32(0L, Z_NULL, 0)*/ ;
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            state.check = crc32(state.check, hbuf, 2, 0);
            //===//

            //=== INITBITS();
            hold = 0;
            bits = 0;
            //===//
            state.mode = FLAGS;
            break;
          }
          state.flags = 0; /* expect zlib header */
          if (state.head) {
            state.head.done = false;
          }
          if (!(state.wrap & 1) || /* check if zlib header allowed */
            (((hold & 0xff) /*BITS(8)*/ << 8) + (hold >> 8)) % 31) {
            strm.msg = 'incorrect header check';
            state.mode = BAD;
            break;
          }
          if ((hold & 0x0f) /*BITS(4)*/ !== Z_DEFLATED$1) {
            strm.msg = 'unknown compression method';
            state.mode = BAD;
            break;
          }
          //--- DROPBITS(4) ---//
          hold >>>= 4;
          bits -= 4;
          //---//
          len = (hold & 0x0f) /*BITS(4)*/ + 8;
          if (state.wbits === 0) {
            state.wbits = len;
          } else if (len > state.wbits) {
            strm.msg = 'invalid window size';
            state.mode = BAD;
            break;
          }
          state.dmax = 1 << len;
          //Tracev((stderr, "inflate:   zlib header ok\n"));
          strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/ ;
          state.mode = hold & 0x200 ? DICTID : TYPE;
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          break;
        case FLAGS:
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.flags = hold;
          if ((state.flags & 0xff) !== Z_DEFLATED$1) {
            strm.msg = 'unknown compression method';
            state.mode = BAD;
            break;
          }
          if (state.flags & 0xe000) {
            strm.msg = 'unknown header flags set';
            state.mode = BAD;
            break;
          }
          if (state.head) {
            state.head.text = ((hold >> 8) & 1);
          }
          if (state.flags & 0x0200) {
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            state.check = crc32(state.check, hbuf, 2, 0);
            //===//
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = TIME;
          /* falls through */
        case TIME:
          //=== NEEDBITS(32); */
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if (state.head) {
            state.head.time = hold;
          }
          if (state.flags & 0x0200) {
            //=== CRC4(state.check, hold)
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            hbuf[2] = (hold >>> 16) & 0xff;
            hbuf[3] = (hold >>> 24) & 0xff;
            state.check = crc32(state.check, hbuf, 4, 0);
            //===
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = OS;
          /* falls through */
        case OS:
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if (state.head) {
            state.head.xflags = (hold & 0xff);
            state.head.os = (hold >> 8);
          }
          if (state.flags & 0x0200) {
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            state.check = crc32(state.check, hbuf, 2, 0);
            //===//
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = EXLEN;
          /* falls through */
        case EXLEN:
          if (state.flags & 0x0400) {
            //=== NEEDBITS(16); */
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            state.length = hold;
            if (state.head) {
              state.head.extra_len = hold;
            }
            if (state.flags & 0x0200) {
              //=== CRC2(state.check, hold);
              hbuf[0] = hold & 0xff;
              hbuf[1] = (hold >>> 8) & 0xff;
              state.check = crc32(state.check, hbuf, 2, 0);
              //===//
            }
            //=== INITBITS();
            hold = 0;
            bits = 0;
            //===//
          } else if (state.head) {
            state.head.extra = null /*Z_NULL*/ ;
          }
          state.mode = EXTRA;
          /* falls through */
        case EXTRA:
          if (state.flags & 0x0400) {
            copy = state.length;
            if (copy > have) {
              copy = have;
            }
            if (copy) {
              if (state.head) {
                len = state.head.extra_len - state.length;
                if (!state.head.extra) {
                  // Use untyped array for more conveniend processing later
                  state.head.extra = new Array(state.head.extra_len);
                }
                arraySet(
                  state.head.extra,
                  input,
                  next,
                  // extra field is limited to 65536 bytes
                  // - no need for additional size check
                  copy,
                  /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                  len
                );
                //zmemcpy(state.head.extra + len, next,
                //        len + copy > state.head.extra_max ?
                //        state.head.extra_max - len : copy);
              }
              if (state.flags & 0x0200) {
                state.check = crc32(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              state.length -= copy;
            }
            if (state.length) {
              break inf_leave;
            }
          }
          state.length = 0;
          state.mode = NAME;
          /* falls through */
        case NAME:
          if (state.flags & 0x0800) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              // TODO: 2 or 1 bytes?
              len = input[next + copy++];
              /* use constant limit because in js we should not preallocate memory */
              if (state.head && len &&
                (state.length < 65536 /*state.head.name_max*/ )) {
                state.head.name += String.fromCharCode(len);
              }
            } while (len && copy < have);

            if (state.flags & 0x0200) {
              state.check = crc32(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.name = null;
          }
          state.length = 0;
          state.mode = COMMENT;
          /* falls through */
        case COMMENT:
          if (state.flags & 0x1000) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              /* use constant limit because in js we should not preallocate memory */
              if (state.head && len &&
                (state.length < 65536 /*state.head.comm_max*/ )) {
                state.head.comment += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state.flags & 0x0200) {
              state.check = crc32(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.comment = null;
          }
          state.mode = HCRC;
          /* falls through */
        case HCRC:
          if (state.flags & 0x0200) {
            //=== NEEDBITS(16); */
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            if (hold !== (state.check & 0xffff)) {
              strm.msg = 'header crc mismatch';
              state.mode = BAD;
              break;
            }
            //=== INITBITS();
            hold = 0;
            bits = 0;
            //===//
          }
          if (state.head) {
            state.head.hcrc = ((state.flags >> 9) & 1);
            state.head.done = true;
          }
          strm.adler = state.check = 0;
          state.mode = TYPE;
          break;
        case DICTID:
          //=== NEEDBITS(32); */
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          strm.adler = state.check = zswap32(hold);
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = DICT;
          /* falls through */
        case DICT:
          if (state.havedict === 0) {
            //--- RESTORE() ---
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            //---
            return Z_NEED_DICT$1;
          }
          strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/ ;
          state.mode = TYPE;
          /* falls through */
        case TYPE:
          if (flush === Z_BLOCK$1 || flush === Z_TREES$1) {
            break inf_leave;
          }
          /* falls through */
        case TYPEDO:
          if (state.last) {
            //--- BYTEBITS() ---//
            hold >>>= bits & 7;
            bits -= bits & 7;
            //---//
            state.mode = CHECK;
            break;
          }
          //=== NEEDBITS(3); */
          while (bits < 3) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.last = (hold & 0x01) /*BITS(1)*/ ;
          //--- DROPBITS(1) ---//
          hold >>>= 1;
          bits -= 1;
          //---//

          switch ((hold & 0x03) /*BITS(2)*/ ) {
          case 0:
            /* stored block */
            //Tracev((stderr, "inflate:     stored block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = STORED;
            break;
          case 1:
            /* fixed block */
            fixedtables(state);
            //Tracev((stderr, "inflate:     fixed codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = LEN_; /* decode codes */
            if (flush === Z_TREES$1) {
              //--- DROPBITS(2) ---//
              hold >>>= 2;
              bits -= 2;
              //---//
              break inf_leave;
            }
            break;
          case 2:
            /* dynamic block */
            //Tracev((stderr, "inflate:     dynamic codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = TABLE;
            break;
          case 3:
            strm.msg = 'invalid block type';
            state.mode = BAD;
          }
          //--- DROPBITS(2) ---//
          hold >>>= 2;
          bits -= 2;
          //---//
          break;
        case STORED:
          //--- BYTEBITS() ---// /* go to byte boundary */
          hold >>>= bits & 7;
          bits -= bits & 7;
          //---//
          //=== NEEDBITS(32); */
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
            strm.msg = 'invalid stored block lengths';
            state.mode = BAD;
            break;
          }
          state.length = hold & 0xffff;
          //Tracev((stderr, "inflate:       stored length %u\n",
          //        state.length));
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = COPY_;
          if (flush === Z_TREES$1) {
            break inf_leave;
          }
          /* falls through */
        case COPY_:
          state.mode = COPY;
          /* falls through */
        case COPY:
          copy = state.length;
          if (copy) {
            if (copy > have) {
              copy = have;
            }
            if (copy > left) {
              copy = left;
            }
            if (copy === 0) {
              break inf_leave;
            }
            //--- zmemcpy(put, next, copy); ---
            arraySet(output, input, next, copy, put);
            //---//
            have -= copy;
            next += copy;
            left -= copy;
            put += copy;
            state.length -= copy;
            break;
          }
          //Tracev((stderr, "inflate:       stored end\n"));
          state.mode = TYPE;
          break;
        case TABLE:
          //=== NEEDBITS(14); */
          while (bits < 14) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.nlen = (hold & 0x1f) /*BITS(5)*/ + 257;
          //--- DROPBITS(5) ---//
          hold >>>= 5;
          bits -= 5;
          //---//
          state.ndist = (hold & 0x1f) /*BITS(5)*/ + 1;
          //--- DROPBITS(5) ---//
          hold >>>= 5;
          bits -= 5;
          //---//
          state.ncode = (hold & 0x0f) /*BITS(4)*/ + 4;
          //--- DROPBITS(4) ---//
          hold >>>= 4;
          bits -= 4;
          //---//
          //#ifndef PKZIP_BUG_WORKAROUND
          if (state.nlen > 286 || state.ndist > 30) {
            strm.msg = 'too many length or distance symbols';
            state.mode = BAD;
            break;
          }
          //#endif
          //Tracev((stderr, "inflate:       table sizes ok\n"));
          state.have = 0;
          state.mode = LENLENS;
          /* falls through */
        case LENLENS:
          while (state.have < state.ncode) {
            //=== NEEDBITS(3);
            while (bits < 3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            state.lens[order[state.have++]] = (hold & 0x07); //BITS(3);
            //--- DROPBITS(3) ---//
            hold >>>= 3;
            bits -= 3;
            //---//
          }
          while (state.have < 19) {
            state.lens[order[state.have++]] = 0;
          }
          // We have separate tables & no pointers. 2 commented lines below not needed.
          //state.next = state.codes;
          //state.lencode = state.next;
          // Switch to use dynamic table
          state.lencode = state.lendyn;
          state.lenbits = 7;

          opts = {
            bits: state.lenbits
          };
          ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;

          if (ret) {
            strm.msg = 'invalid code lengths set';
            state.mode = BAD;
            break;
          }
          //Tracev((stderr, "inflate:       code lengths ok\n"));
          state.have = 0;
          state.mode = CODELENS;
          /* falls through */
        case CODELENS:
          while (state.have < state.nlen + state.ndist) {
            for (;;) {
              here = state.lencode[hold & ((1 << state.lenbits) - 1)]; /*BITS(state.lenbits)*/
              here_bits = here >>> 24;
              here_op = (here >>> 16) & 0xff;
              here_val = here & 0xffff;

              if ((here_bits) <= bits) {
                break;
              }
              //--- PULLBYTE() ---//
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
              //---//
            }
            if (here_val < 16) {
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              state.lens[state.have++] = here_val;
            } else {
              if (here_val === 16) {
                //=== NEEDBITS(here.bits + 2);
                n = here_bits + 2;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                //===//
                //--- DROPBITS(here.bits) ---//
                hold >>>= here_bits;
                bits -= here_bits;
                //---//
                if (state.have === 0) {
                  strm.msg = 'invalid bit length repeat';
                  state.mode = BAD;
                  break;
                }
                len = state.lens[state.have - 1];
                copy = 3 + (hold & 0x03); //BITS(2);
                //--- DROPBITS(2) ---//
                hold >>>= 2;
                bits -= 2;
                //---//
              } else if (here_val === 17) {
                //=== NEEDBITS(here.bits + 3);
                n = here_bits + 3;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                //===//
                //--- DROPBITS(here.bits) ---//
                hold >>>= here_bits;
                bits -= here_bits;
                //---//
                len = 0;
                copy = 3 + (hold & 0x07); //BITS(3);
                //--- DROPBITS(3) ---//
                hold >>>= 3;
                bits -= 3;
                //---//
              } else {
                //=== NEEDBITS(here.bits + 7);
                n = here_bits + 7;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                //===//
                //--- DROPBITS(here.bits) ---//
                hold >>>= here_bits;
                bits -= here_bits;
                //---//
                len = 0;
                copy = 11 + (hold & 0x7f); //BITS(7);
                //--- DROPBITS(7) ---//
                hold >>>= 7;
                bits -= 7;
                //---//
              }
              if (state.have + copy > state.nlen + state.ndist) {
                strm.msg = 'invalid bit length repeat';
                state.mode = BAD;
                break;
              }
              while (copy--) {
                state.lens[state.have++] = len;
              }
            }
          }

          /* handle error breaks in while */
          if (state.mode === BAD) {
            break;
          }

          /* check for end-of-block code (better have one) */
          if (state.lens[256] === 0) {
            strm.msg = 'invalid code -- missing end-of-block';
            state.mode = BAD;
            break;
          }

          /* build code tables -- note: do not change the lenbits or distbits
             values here (9 and 6) without reading the comments in inftrees.h
             concerning the ENOUGH constants, which depend on those values */
          state.lenbits = 9;

          opts = {
            bits: state.lenbits
          };
          ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
          // We have separate tables & no pointers. 2 commented lines below not needed.
          // state.next_index = opts.table_index;
          state.lenbits = opts.bits;
          // state.lencode = state.next;

          if (ret) {
            strm.msg = 'invalid literal/lengths set';
            state.mode = BAD;
            break;
          }

          state.distbits = 6;
          //state.distcode.copy(state.codes);
          // Switch to use dynamic table
          state.distcode = state.distdyn;
          opts = {
            bits: state.distbits
          };
          ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
          // We have separate tables & no pointers. 2 commented lines below not needed.
          // state.next_index = opts.table_index;
          state.distbits = opts.bits;
          // state.distcode = state.next;

          if (ret) {
            strm.msg = 'invalid distances set';
            state.mode = BAD;
            break;
          }
          //Tracev((stderr, 'inflate:       codes ok\n'));
          state.mode = LEN_;
          if (flush === Z_TREES$1) {
            break inf_leave;
          }
          /* falls through */
        case LEN_:
          state.mode = LEN;
          /* falls through */
        case LEN:
          if (have >= 6 && left >= 258) {
            //--- RESTORE() ---
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            //---
            inflate_fast(strm, _out);
            //--- LOAD() ---
            put = strm.next_out;
            output = strm.output;
            left = strm.avail_out;
            next = strm.next_in;
            input = strm.input;
            have = strm.avail_in;
            hold = state.hold;
            bits = state.bits;
            //---

            if (state.mode === TYPE) {
              state.back = -1;
            }
            break;
          }
          state.back = 0;
          for (;;) {
            here = state.lencode[hold & ((1 << state.lenbits) - 1)]; /*BITS(state.lenbits)*/
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if (here_bits <= bits) {
              break;
            }
            //--- PULLBYTE() ---//
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          if (here_op && (here_op & 0xf0) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (;;) {
              here = state.lencode[last_val +
                ((hold & ((1 << (last_bits + last_op)) - 1)) /*BITS(last.bits + last.op)*/ >> last_bits)];
              here_bits = here >>> 24;
              here_op = (here >>> 16) & 0xff;
              here_val = here & 0xffff;

              if ((last_bits + here_bits) <= bits) {
                break;
              }
              //--- PULLBYTE() ---//
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
              //---//
            }
            //--- DROPBITS(last.bits) ---//
            hold >>>= last_bits;
            bits -= last_bits;
            //---//
            state.back += last_bits;
          }
          //--- DROPBITS(here.bits) ---//
          hold >>>= here_bits;
          bits -= here_bits;
          //---//
          state.back += here_bits;
          state.length = here_val;
          if (here_op === 0) {
            //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
            //        "inflate:         literal '%c'\n" :
            //        "inflate:         literal 0x%02x\n", here.val));
            state.mode = LIT;
            break;
          }
          if (here_op & 32) {
            //Tracevv((stderr, "inflate:         end of block\n"));
            state.back = -1;
            state.mode = TYPE;
            break;
          }
          if (here_op & 64) {
            strm.msg = 'invalid literal/length code';
            state.mode = BAD;
            break;
          }
          state.extra = here_op & 15;
          state.mode = LENEXT;
          /* falls through */
        case LENEXT:
          if (state.extra) {
            //=== NEEDBITS(state.extra);
            n = state.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            state.length += hold & ((1 << state.extra) - 1) /*BITS(state.extra)*/ ;
            //--- DROPBITS(state.extra) ---//
            hold >>>= state.extra;
            bits -= state.extra;
            //---//
            state.back += state.extra;
          }
          //Tracevv((stderr, "inflate:         length %u\n", state.length));
          state.was = state.length;
          state.mode = DIST;
          /* falls through */
        case DIST:
          for (;;) {
            here = state.distcode[hold & ((1 << state.distbits) - 1)]; /*BITS(state.distbits)*/
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((here_bits) <= bits) {
              break;
            }
            //--- PULLBYTE() ---//
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          if ((here_op & 0xf0) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (;;) {
              here = state.distcode[last_val +
                ((hold & ((1 << (last_bits + last_op)) - 1)) /*BITS(last.bits + last.op)*/ >> last_bits)];
              here_bits = here >>> 24;
              here_op = (here >>> 16) & 0xff;
              here_val = here & 0xffff;

              if ((last_bits + here_bits) <= bits) {
                break;
              }
              //--- PULLBYTE() ---//
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
              //---//
            }
            //--- DROPBITS(last.bits) ---//
            hold >>>= last_bits;
            bits -= last_bits;
            //---//
            state.back += last_bits;
          }
          //--- DROPBITS(here.bits) ---//
          hold >>>= here_bits;
          bits -= here_bits;
          //---//
          state.back += here_bits;
          if (here_op & 64) {
            strm.msg = 'invalid distance code';
            state.mode = BAD;
            break;
          }
          state.offset = here_val;
          state.extra = (here_op) & 15;
          state.mode = DISTEXT;
          /* falls through */
        case DISTEXT:
          if (state.extra) {
            //=== NEEDBITS(state.extra);
            n = state.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            state.offset += hold & ((1 << state.extra) - 1) /*BITS(state.extra)*/ ;
            //--- DROPBITS(state.extra) ---//
            hold >>>= state.extra;
            bits -= state.extra;
            //---//
            state.back += state.extra;
          }
          //#ifdef INFLATE_STRICT
          if (state.offset > state.dmax) {
            strm.msg = 'invalid distance too far back';
            state.mode = BAD;
            break;
          }
          //#endif
          //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
          state.mode = MATCH;
          /* falls through */
        case MATCH:
          if (left === 0) {
            break inf_leave;
          }
          copy = _out - left;
          if (state.offset > copy) { /* copy from window */
            copy = state.offset - copy;
            if (copy > state.whave) {
              if (state.sane) {
                strm.msg = 'invalid distance too far back';
                state.mode = BAD;
                break;
              }
              // (!) This block is disabled in zlib defailts,
              // don't enable it for binary compatibility
              //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
              //          Trace((stderr, "inflate.c too far\n"));
              //          copy -= state.whave;
              //          if (copy > state.length) { copy = state.length; }
              //          if (copy > left) { copy = left; }
              //          left -= copy;
              //          state.length -= copy;
              //          do {
              //            output[put++] = 0;
              //          } while (--copy);
              //          if (state.length === 0) { state.mode = LEN; }
              //          break;
              //#endif
            }
            if (copy > state.wnext) {
              copy -= state.wnext;
              from = state.wsize - copy;
            } else {
              from = state.wnext - copy;
            }
            if (copy > state.length) {
              copy = state.length;
            }
            from_source = state.window;
          } else { /* copy from output */
            from_source = output;
            from = put - state.offset;
            copy = state.length;
          }
          if (copy > left) {
            copy = left;
          }
          left -= copy;
          state.length -= copy;
          do {
            output[put++] = from_source[from++];
          } while (--copy);
          if (state.length === 0) {
            state.mode = LEN;
          }
          break;
        case LIT:
          if (left === 0) {
            break inf_leave;
          }
          output[put++] = state.length;
          left--;
          state.mode = LEN;
          break;
        case CHECK:
          if (state.wrap) {
            //=== NEEDBITS(32);
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              // Use '|' insdead of '+' to make sure that result is signed
              hold |= input[next++] << bits;
              bits += 8;
            }
            //===//
            _out -= left;
            strm.total_out += _out;
            state.total += _out;
            if (_out) {
              strm.adler = state.check =
                /*UPDATE(state.check, put - _out, _out);*/
                (state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out));

            }
            _out = left;
            // NB: crc32 stored as signed 32-bit int, zswap32 returns signed too
            if ((state.flags ? hold : zswap32(hold)) !== state.check) {
              strm.msg = 'incorrect data check';
              state.mode = BAD;
              break;
            }
            //=== INITBITS();
            hold = 0;
            bits = 0;
            //===//
            //Tracev((stderr, "inflate:   check matches trailer\n"));
          }
          state.mode = LENGTH;
          /* falls through */
        case LENGTH:
          if (state.wrap && state.flags) {
            //=== NEEDBITS(32);
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            if (hold !== (state.total & 0xffffffff)) {
              strm.msg = 'incorrect length check';
              state.mode = BAD;
              break;
            }
            //=== INITBITS();
            hold = 0;
            bits = 0;
            //===//
            //Tracev((stderr, "inflate:   length matches trailer\n"));
          }
          state.mode = DONE;
          /* falls through */
        case DONE:
          ret = Z_STREAM_END$1;
          break inf_leave;
        case BAD:
          ret = Z_DATA_ERROR$1;
          break inf_leave;
        case MEM:
          return Z_MEM_ERROR;
        case SYNC:
          /* falls through */
        default:
          return Z_STREAM_ERROR$1;
        }
      }

    // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

    /*
       Return from inflate(), updating the total counts and the check value.
       If there was no progress during the inflate() call, return a buffer
       error.  Call updatewindow() to create and/or update the window state.
       Note: a memory error from inflate() is non-recoverable.
     */

    //--- RESTORE() ---
    strm.next_out = put;
    strm.avail_out = left;
    strm.next_in = next;
    strm.avail_in = have;
    state.hold = hold;
    state.bits = bits;
    //---

    if (state.wsize || (_out !== strm.avail_out && state.mode < BAD &&
        (state.mode < CHECK || flush !== Z_FINISH$1))) {
      if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) ;
    }
    _in -= strm.avail_in;
    _out -= strm.avail_out;
    strm.total_in += _in;
    strm.total_out += _out;
    state.total += _out;
    if (state.wrap && _out) {
      strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
        (state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out));
    }
    strm.data_type = state.bits + (state.last ? 64 : 0) +
      (state.mode === TYPE ? 128 : 0) +
      (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
    if (((_in === 0 && _out === 0) || flush === Z_FINISH$1) && ret === Z_OK$1) {
      ret = Z_BUF_ERROR$1;
    }
    return ret;
  }

  function inflateEnd(strm) {

    if (!strm || !strm.state /*|| strm->zfree == (free_func)0*/ ) {
      return Z_STREAM_ERROR$1;
    }

    var state = strm.state;
    if (state.window) {
      state.window = null;
    }
    strm.state = null;
    return Z_OK$1;
  }

  /* Not implemented
  exports.inflateCopy = inflateCopy;
  exports.inflateGetDictionary = inflateGetDictionary;
  exports.inflateMark = inflateMark;
  exports.inflatePrime = inflatePrime;
  exports.inflateSync = inflateSync;
  exports.inflateSyncPoint = inflateSyncPoint;
  exports.inflateUndermine = inflateUndermine;
  */

  // import constants from './constants';


  // zlib modes
  var NONE = 0;
  var DEFLATE = 1;
  var INFLATE = 2;
  var GZIP = 3;
  var GUNZIP = 4;
  var DEFLATERAW = 5;
  var INFLATERAW = 6;
  var UNZIP = 7;
  var Z_NO_FLUSH=         0,
    Z_PARTIAL_FLUSH=    1,
    Z_SYNC_FLUSH=    2,
    Z_FULL_FLUSH=       3,
    Z_FINISH=       4,
    Z_BLOCK=           5,
    Z_TREES=            6,

    /* Return codes for the compression/decompression functions. Negative values
    * are errors, positive values are used for special but normal events.
    */
    Z_OK=               0,
    Z_STREAM_END=       1,
    Z_NEED_DICT=      2,
    Z_ERRNO=       -1,
    Z_STREAM_ERROR=   -2,
    Z_DATA_ERROR=    -3,
    //Z_MEM_ERROR:     -4,
    Z_BUF_ERROR=    -5,
    //Z_VERSION_ERROR: -6,

    /* compression levels */
    Z_NO_COMPRESSION=         0,
    Z_BEST_SPEED=             1,
    Z_BEST_COMPRESSION=       9,
    Z_DEFAULT_COMPRESSION=   -1,


    Z_FILTERED=               1,
    Z_HUFFMAN_ONLY=           2,
    Z_RLE=                    3,
    Z_FIXED=                  4,
    Z_DEFAULT_STRATEGY=       0,

    /* Possible values of the data_type field (though see inflate()) */
    Z_BINARY=                 0,
    Z_TEXT=                   1,
    //Z_ASCII:                1, // = Z_TEXT (deprecated)
    Z_UNKNOWN=                2,

    /* The deflate compression method */
    Z_DEFLATED=               8;
  function Zlib$1(mode) {
    if (mode < DEFLATE || mode > UNZIP)
      throw new TypeError('Bad argument');

    this.mode = mode;
    this.init_done = false;
    this.write_in_progress = false;
    this.pending_close = false;
    this.windowBits = 0;
    this.level = 0;
    this.memLevel = 0;
    this.strategy = 0;
    this.dictionary = null;
  }

  Zlib$1.prototype.init = function(windowBits, level, memLevel, strategy, dictionary) {
    this.windowBits = windowBits;
    this.level = level;
    this.memLevel = memLevel;
    this.strategy = strategy;
    // dictionary not supported.

    if (this.mode === GZIP || this.mode === GUNZIP)
      this.windowBits += 16;

    if (this.mode === UNZIP)
      this.windowBits += 32;

    if (this.mode === DEFLATERAW || this.mode === INFLATERAW)
      this.windowBits = -this.windowBits;

    this.strm = new ZStream();
    var status;
    switch (this.mode) {
    case DEFLATE:
    case GZIP:
    case DEFLATERAW:
      status = deflateInit2(
        this.strm,
        this.level,
        Z_DEFLATED,
        this.windowBits,
        this.memLevel,
        this.strategy
      );
      break;
    case INFLATE:
    case GUNZIP:
    case INFLATERAW:
    case UNZIP:
      status  = inflateInit2(
        this.strm,
        this.windowBits
      );
      break;
    default:
      throw new Error('Unknown mode ' + this.mode);
    }

    if (status !== Z_OK) {
      this._error(status);
      return;
    }

    this.write_in_progress = false;
    this.init_done = true;
  };

  Zlib$1.prototype.params = function() {
    throw new Error('deflateParams Not supported');
  };

  Zlib$1.prototype._writeCheck = function() {
    if (!this.init_done)
      throw new Error('write before init');

    if (this.mode === NONE)
      throw new Error('already finalized');

    if (this.write_in_progress)
      throw new Error('write already in progress');

    if (this.pending_close)
      throw new Error('close is pending');
  };

  Zlib$1.prototype.write = function(flush, input, in_off, in_len, out, out_off, out_len) {
    this._writeCheck();
    this.write_in_progress = true;

    var self = this;
    browser$1$1.nextTick(function() {
      self.write_in_progress = false;
      var res = self._write(flush, input, in_off, in_len, out, out_off, out_len);
      self.callback(res[0], res[1]);

      if (self.pending_close)
        self.close();
    });

    return this;
  };

  // set method for Node buffers, used by pako
  function bufferSet(data, offset) {
    for (var i = 0; i < data.length; i++) {
      this[offset + i] = data[i];
    }
  }

  Zlib$1.prototype.writeSync = function(flush, input, in_off, in_len, out, out_off, out_len) {
    this._writeCheck();
    return this._write(flush, input, in_off, in_len, out, out_off, out_len);
  };

  Zlib$1.prototype._write = function(flush, input, in_off, in_len, out, out_off, out_len) {
    this.write_in_progress = true;

    if (flush !== Z_NO_FLUSH &&
        flush !== Z_PARTIAL_FLUSH &&
        flush !== Z_SYNC_FLUSH &&
        flush !== Z_FULL_FLUSH &&
        flush !== Z_FINISH &&
        flush !== Z_BLOCK) {
      throw new Error('Invalid flush value');
    }

    if (input == null) {
      input = new Buffer(0);
      in_len = 0;
      in_off = 0;
    }

    if (out._set)
      out.set = out._set;
    else
      out.set = bufferSet;

    var strm = this.strm;
    strm.avail_in = in_len;
    strm.input = input;
    strm.next_in = in_off;
    strm.avail_out = out_len;
    strm.output = out;
    strm.next_out = out_off;
    var status;
    switch (this.mode) {
    case DEFLATE:
    case GZIP:
    case DEFLATERAW:
      status = deflate$1(strm, flush);
      break;
    case UNZIP:
    case INFLATE:
    case GUNZIP:
    case INFLATERAW:
      status = inflate$1(strm, flush);
      break;
    default:
      throw new Error('Unknown mode ' + this.mode);
    }

    if (!this._checkError(status, strm, flush)) {
      this._error(status);
    }

    this.write_in_progress = false;
    return [strm.avail_in, strm.avail_out];
  };

  Zlib$1.prototype._checkError = function (status, strm, flush) {
    // Acceptable error states depend on the type of zlib stream.
    switch (status) {
      case Z_OK:
      case Z_BUF_ERROR:
        if (strm.avail_out !== 0 && flush === Z_FINISH) {
          return false
        }
        break
      case Z_STREAM_END:
        // normal statuses, not fatal
        break
      case Z_NEED_DICT:
        return false
      default:
        return false
    }

    return true
  };

  Zlib$1.prototype.close = function() {
    if (this.write_in_progress) {
      this.pending_close = true;
      return;
    }

    this.pending_close = false;

    if (this.mode === DEFLATE || this.mode === GZIP || this.mode === DEFLATERAW) {
      deflateEnd(this.strm);
    } else {
      inflateEnd(this.strm);
    }

    this.mode = NONE;
  };
  var status;
  Zlib$1.prototype.reset = function() {
    switch (this.mode) {
    case DEFLATE:
    case DEFLATERAW:
      status = deflateReset(this.strm);
      break;
    case INFLATE:
    case INFLATERAW:
      status = inflateReset(this.strm);
      break;
    }

    if (status !== Z_OK) {
      this._error(status);
    }
  };

  Zlib$1.prototype._error = function(status) {
    this.onerror(msg[status] + ': ' + this.strm.msg, status);

    this.write_in_progress = false;
    if (this.pending_close)
      this.close();
  };

  var _binding = /*#__PURE__*/Object.freeze({
    __proto__: null,
    DEFLATE: DEFLATE,
    DEFLATERAW: DEFLATERAW,
    GUNZIP: GUNZIP,
    GZIP: GZIP,
    INFLATE: INFLATE,
    INFLATERAW: INFLATERAW,
    NONE: NONE,
    UNZIP: UNZIP,
    Z_BEST_COMPRESSION: Z_BEST_COMPRESSION,
    Z_BEST_SPEED: Z_BEST_SPEED,
    Z_BINARY: Z_BINARY,
    Z_BLOCK: Z_BLOCK,
    Z_BUF_ERROR: Z_BUF_ERROR,
    Z_DATA_ERROR: Z_DATA_ERROR,
    Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION,
    Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY,
    Z_DEFLATED: Z_DEFLATED,
    Z_ERRNO: Z_ERRNO,
    Z_FILTERED: Z_FILTERED,
    Z_FINISH: Z_FINISH,
    Z_FIXED: Z_FIXED,
    Z_FULL_FLUSH: Z_FULL_FLUSH,
    Z_HUFFMAN_ONLY: Z_HUFFMAN_ONLY,
    Z_NEED_DICT: Z_NEED_DICT,
    Z_NO_COMPRESSION: Z_NO_COMPRESSION,
    Z_NO_FLUSH: Z_NO_FLUSH,
    Z_OK: Z_OK,
    Z_PARTIAL_FLUSH: Z_PARTIAL_FLUSH,
    Z_RLE: Z_RLE,
    Z_STREAM_END: Z_STREAM_END,
    Z_STREAM_ERROR: Z_STREAM_ERROR,
    Z_SYNC_FLUSH: Z_SYNC_FLUSH,
    Z_TEXT: Z_TEXT,
    Z_TREES: Z_TREES,
    Z_UNKNOWN: Z_UNKNOWN,
    Zlib: Zlib$1
  });

  function assert$1 (a, msg) {
    if (!a) {
      throw new Error(msg);
    }
  }
  var binding = {};
  Object.keys(_binding).forEach(function (key) {
    binding[key] = _binding[key];
  });
  // zlib doesn't provide these, so kludge them in following the same
  // const naming scheme zlib uses.
  binding.Z_MIN_WINDOWBITS = 8;
  binding.Z_MAX_WINDOWBITS = 15;
  binding.Z_DEFAULT_WINDOWBITS = 15;

  // fewer than 64 bytes per chunk is stupid.
  // technically it could work with as few as 8, but even 64 bytes
  // is absurdly low.  Usually a MB or more is best.
  binding.Z_MIN_CHUNK = 64;
  binding.Z_MAX_CHUNK = Infinity;
  binding.Z_DEFAULT_CHUNK = (16 * 1024);

  binding.Z_MIN_MEMLEVEL = 1;
  binding.Z_MAX_MEMLEVEL = 9;
  binding.Z_DEFAULT_MEMLEVEL = 8;

  binding.Z_MIN_LEVEL = -1;
  binding.Z_MAX_LEVEL = 9;
  binding.Z_DEFAULT_LEVEL = binding.Z_DEFAULT_COMPRESSION;


  // translation table for return codes.
  var codes = {
    Z_OK: binding.Z_OK,
    Z_STREAM_END: binding.Z_STREAM_END,
    Z_NEED_DICT: binding.Z_NEED_DICT,
    Z_ERRNO: binding.Z_ERRNO,
    Z_STREAM_ERROR: binding.Z_STREAM_ERROR,
    Z_DATA_ERROR: binding.Z_DATA_ERROR,
    Z_MEM_ERROR: binding.Z_MEM_ERROR,
    Z_BUF_ERROR: binding.Z_BUF_ERROR,
    Z_VERSION_ERROR: binding.Z_VERSION_ERROR
  };

  Object.keys(codes).forEach(function(k) {
    codes[codes[k]] = k;
  });

  function createDeflate(o) {
    return new Deflate(o);
  }

  function createInflate(o) {
    return new Inflate(o);
  }

  function createDeflateRaw(o) {
    return new DeflateRaw(o);
  }

  function createInflateRaw(o) {
    return new InflateRaw(o);
  }

  function createGzip(o) {
    return new Gzip(o);
  }

  function createGunzip(o) {
    return new Gunzip(o);
  }

  function createUnzip(o) {
    return new Unzip(o);
  }


  // Convenience methods.
  // compress/decompress a string or buffer in one step.
  function deflate(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Deflate(opts), buffer, callback);
  }

  function deflateSync(buffer, opts) {
    return zlibBufferSync(new Deflate(opts), buffer);
  }

  function gzip(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Gzip(opts), buffer, callback);
  }

  function gzipSync(buffer, opts) {
    return zlibBufferSync(new Gzip(opts), buffer);
  }

  function deflateRaw(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new DeflateRaw(opts), buffer, callback);
  }

  function deflateRawSync(buffer, opts) {
    return zlibBufferSync(new DeflateRaw(opts), buffer);
  }

  function unzip(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Unzip(opts), buffer, callback);
  }

  function unzipSync(buffer, opts) {
    return zlibBufferSync(new Unzip(opts), buffer);
  }

  function inflate(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Inflate(opts), buffer, callback);
  }

  function inflateSync(buffer, opts) {
    return zlibBufferSync(new Inflate(opts), buffer);
  }

  function gunzip(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Gunzip(opts), buffer, callback);
  }

  function gunzipSync(buffer, opts) {
    return zlibBufferSync(new Gunzip(opts), buffer);
  }

  function inflateRaw(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new InflateRaw(opts), buffer, callback);
  }

  function inflateRawSync(buffer, opts) {
    return zlibBufferSync(new InflateRaw(opts), buffer);
  }

  function zlibBuffer(engine, buffer, callback) {
    var buffers = [];
    var nread = 0;

    engine.on('error', onError);
    engine.on('end', onEnd);

    engine.end(buffer);
    flow();

    function flow() {
      var chunk;
      while (null !== (chunk = engine.read())) {
        buffers.push(chunk);
        nread += chunk.length;
      }
      engine.once('readable', flow);
    }

    function onError(err) {
      engine.removeListener('end', onEnd);
      engine.removeListener('readable', flow);
      callback(err);
    }

    function onEnd() {
      var buf = Buffer.concat(buffers, nread);
      buffers = [];
      callback(null, buf);
      engine.close();
    }
  }

  function zlibBufferSync(engine, buffer) {
    if (typeof buffer === 'string')
      buffer = new Buffer(buffer);
    if (!Buffer.isBuffer(buffer))
      throw new TypeError('Not a string or buffer');

    var flushFlag = binding.Z_FINISH;

    return engine._processChunk(buffer, flushFlag);
  }

  // generic zlib
  // minimal 2-byte header
  function Deflate(opts) {
    if (!(this instanceof Deflate)) return new Deflate(opts);
    Zlib.call(this, opts, binding.DEFLATE);
  }

  function Inflate(opts) {
    if (!(this instanceof Inflate)) return new Inflate(opts);
    Zlib.call(this, opts, binding.INFLATE);
  }



  // gzip - bigger header, same deflate compression
  function Gzip(opts) {
    if (!(this instanceof Gzip)) return new Gzip(opts);
    Zlib.call(this, opts, binding.GZIP);
  }

  function Gunzip(opts) {
    if (!(this instanceof Gunzip)) return new Gunzip(opts);
    Zlib.call(this, opts, binding.GUNZIP);
  }



  // raw - no header
  function DeflateRaw(opts) {
    if (!(this instanceof DeflateRaw)) return new DeflateRaw(opts);
    Zlib.call(this, opts, binding.DEFLATERAW);
  }

  function InflateRaw(opts) {
    if (!(this instanceof InflateRaw)) return new InflateRaw(opts);
    Zlib.call(this, opts, binding.INFLATERAW);
  }


  // auto-detect header.
  function Unzip(opts) {
    if (!(this instanceof Unzip)) return new Unzip(opts);
    Zlib.call(this, opts, binding.UNZIP);
  }


  // the Zlib class they all inherit from
  // This thing manages the queue of requests, and returns
  // true or false if there is anything in the queue when
  // you call the .write() method.

  function Zlib(opts, mode) {
    this._opts = opts = opts || {};
    this._chunkSize = opts.chunkSize || binding.Z_DEFAULT_CHUNK;

    Transform.call(this, opts);

    if (opts.flush) {
      if (opts.flush !== binding.Z_NO_FLUSH &&
          opts.flush !== binding.Z_PARTIAL_FLUSH &&
          opts.flush !== binding.Z_SYNC_FLUSH &&
          opts.flush !== binding.Z_FULL_FLUSH &&
          opts.flush !== binding.Z_FINISH &&
          opts.flush !== binding.Z_BLOCK) {
        throw new Error('Invalid flush flag: ' + opts.flush);
      }
    }
    this._flushFlag = opts.flush || binding.Z_NO_FLUSH;

    if (opts.chunkSize) {
      if (opts.chunkSize < binding.Z_MIN_CHUNK ||
          opts.chunkSize > binding.Z_MAX_CHUNK) {
        throw new Error('Invalid chunk size: ' + opts.chunkSize);
      }
    }

    if (opts.windowBits) {
      if (opts.windowBits < binding.Z_MIN_WINDOWBITS ||
          opts.windowBits > binding.Z_MAX_WINDOWBITS) {
        throw new Error('Invalid windowBits: ' + opts.windowBits);
      }
    }

    if (opts.level) {
      if (opts.level < binding.Z_MIN_LEVEL ||
          opts.level > binding.Z_MAX_LEVEL) {
        throw new Error('Invalid compression level: ' + opts.level);
      }
    }

    if (opts.memLevel) {
      if (opts.memLevel < binding.Z_MIN_MEMLEVEL ||
          opts.memLevel > binding.Z_MAX_MEMLEVEL) {
        throw new Error('Invalid memLevel: ' + opts.memLevel);
      }
    }

    if (opts.strategy) {
      if (opts.strategy != binding.Z_FILTERED &&
          opts.strategy != binding.Z_HUFFMAN_ONLY &&
          opts.strategy != binding.Z_RLE &&
          opts.strategy != binding.Z_FIXED &&
          opts.strategy != binding.Z_DEFAULT_STRATEGY) {
        throw new Error('Invalid strategy: ' + opts.strategy);
      }
    }

    if (opts.dictionary) {
      if (!Buffer.isBuffer(opts.dictionary)) {
        throw new Error('Invalid dictionary: it should be a Buffer instance');
      }
    }

    this._binding = new binding.Zlib(mode);

    var self = this;
    this._hadError = false;
    this._binding.onerror = function(message, errno) {
      // there is no way to cleanly recover.
      // continuing only obscures problems.
      self._binding = null;
      self._hadError = true;

      var error = new Error(message);
      error.errno = errno;
      error.code = codes[errno];
      self.emit('error', error);
    };

    var level = binding.Z_DEFAULT_COMPRESSION;
    if (typeof opts.level === 'number') level = opts.level;

    var strategy = binding.Z_DEFAULT_STRATEGY;
    if (typeof opts.strategy === 'number') strategy = opts.strategy;

    this._binding.init(opts.windowBits || binding.Z_DEFAULT_WINDOWBITS,
                       level,
                       opts.memLevel || binding.Z_DEFAULT_MEMLEVEL,
                       strategy,
                       opts.dictionary);

    this._buffer = new Buffer(this._chunkSize);
    this._offset = 0;
    this._closed = false;
    this._level = level;
    this._strategy = strategy;

    this.once('end', this.close);
  }

  inherits(Zlib, Transform);

  Zlib.prototype.params = function(level, strategy, callback) {
    if (level < binding.Z_MIN_LEVEL ||
        level > binding.Z_MAX_LEVEL) {
      throw new RangeError('Invalid compression level: ' + level);
    }
    if (strategy != binding.Z_FILTERED &&
        strategy != binding.Z_HUFFMAN_ONLY &&
        strategy != binding.Z_RLE &&
        strategy != binding.Z_FIXED &&
        strategy != binding.Z_DEFAULT_STRATEGY) {
      throw new TypeError('Invalid strategy: ' + strategy);
    }

    if (this._level !== level || this._strategy !== strategy) {
      var self = this;
      this.flush(binding.Z_SYNC_FLUSH, function() {
        self._binding.params(level, strategy);
        if (!self._hadError) {
          self._level = level;
          self._strategy = strategy;
          if (callback) callback();
        }
      });
    } else {
      browser$1$1.nextTick(callback);
    }
  };

  Zlib.prototype.reset = function() {
    return this._binding.reset();
  };

  // This is the _flush function called by the transform class,
  // internally, when the last chunk has been written.
  Zlib.prototype._flush = function(callback) {
    this._transform(new Buffer(0), '', callback);
  };

  Zlib.prototype.flush = function(kind, callback) {
    var ws = this._writableState;

    if (typeof kind === 'function' || (kind === void 0 && !callback)) {
      callback = kind;
      kind = binding.Z_FULL_FLUSH;
    }

    if (ws.ended) {
      if (callback)
        browser$1$1.nextTick(callback);
    } else if (ws.ending) {
      if (callback)
        this.once('end', callback);
    } else if (ws.needDrain) {
      var self = this;
      this.once('drain', function() {
        self.flush(callback);
      });
    } else {
      this._flushFlag = kind;
      this.write(new Buffer(0), '', callback);
    }
  };

  Zlib.prototype.close = function(callback) {
    if (callback)
      browser$1$1.nextTick(callback);

    if (this._closed)
      return;

    this._closed = true;

    this._binding.close();

    var self = this;
    browser$1$1.nextTick(function() {
      self.emit('close');
    });
  };

  Zlib.prototype._transform = function(chunk, encoding, cb) {
    var flushFlag;
    var ws = this._writableState;
    var ending = ws.ending || ws.ended;
    var last = ending && (!chunk || ws.length === chunk.length);

    if (!chunk === null && !Buffer.isBuffer(chunk))
      return cb(new Error('invalid input'));

    // If it's the last chunk, or a final flush, we use the Z_FINISH flush flag.
    // If it's explicitly flushing at some other time, then we use
    // Z_FULL_FLUSH. Otherwise, use Z_NO_FLUSH for maximum compression
    // goodness.
    if (last)
      flushFlag = binding.Z_FINISH;
    else {
      flushFlag = this._flushFlag;
      // once we've flushed the last of the queue, stop flushing and
      // go back to the normal behavior.
      if (chunk.length >= ws.length) {
        this._flushFlag = this._opts.flush || binding.Z_NO_FLUSH;
      }
    }

    this._processChunk(chunk, flushFlag, cb);
  };

  Zlib.prototype._processChunk = function(chunk, flushFlag, cb) {
    var availInBefore = chunk && chunk.length;
    var availOutBefore = this._chunkSize - this._offset;
    var inOff = 0;

    var self = this;

    var async = typeof cb === 'function';

    if (!async) {
      var buffers = [];
      var nread = 0;

      var error;
      this.on('error', function(er) {
        error = er;
      });

      do {
        var res = this._binding.writeSync(flushFlag,
                                          chunk, // in
                                          inOff, // in_off
                                          availInBefore, // in_len
                                          this._buffer, // out
                                          this._offset, //out_off
                                          availOutBefore); // out_len
      } while (!this._hadError && callback(res[0], res[1]));

      if (this._hadError) {
        throw error;
      }

      var buf = Buffer.concat(buffers, nread);
      this.close();

      return buf;
    }

    var req = this._binding.write(flushFlag,
                                  chunk, // in
                                  inOff, // in_off
                                  availInBefore, // in_len
                                  this._buffer, // out
                                  this._offset, //out_off
                                  availOutBefore); // out_len

    req.buffer = chunk;
    req.callback = callback;

    function callback(availInAfter, availOutAfter) {
      if (self._hadError)
        return;

      var have = availOutBefore - availOutAfter;
      assert$1(have >= 0, 'have should not go down');

      if (have > 0) {
        var out = self._buffer.slice(self._offset, self._offset + have);
        self._offset += have;
        // serve some output to the consumer.
        if (async) {
          self.push(out);
        } else {
          buffers.push(out);
          nread += out.length;
        }
      }

      // exhausted the output buffer, or used all the input create a new one.
      if (availOutAfter === 0 || self._offset >= self._chunkSize) {
        availOutBefore = self._chunkSize;
        self._offset = 0;
        self._buffer = new Buffer(self._chunkSize);
      }

      if (availOutAfter === 0) {
        // Not actually done.  Need to reprocess.
        // Also, update the availInBefore to the availInAfter value,
        // so that if we have to hit it a third (fourth, etc.) time,
        // it'll have the correct byte counts.
        inOff += (availInBefore - availInAfter);
        availInBefore = availInAfter;

        if (!async)
          return true;

        var newReq = self._binding.write(flushFlag,
                                         chunk,
                                         inOff,
                                         availInBefore,
                                         self._buffer,
                                         self._offset,
                                         self._chunkSize);
        newReq.callback = callback; // this same function
        newReq.buffer = chunk;
        return;
      }

      if (!async)
        return false;

      // finished with the chunk.
      cb();
    }
  };

  inherits(Deflate, Zlib);
  inherits(Inflate, Zlib);
  inherits(Gzip, Zlib);
  inherits(Gunzip, Zlib);
  inherits(DeflateRaw, Zlib);
  inherits(InflateRaw, Zlib);
  inherits(Unzip, Zlib);
  var _polyfillNode_zlib = {
    codes: codes,
    createDeflate: createDeflate,
    createInflate: createInflate,
    createDeflateRaw: createDeflateRaw,
    createInflateRaw: createInflateRaw,
    createGzip: createGzip,
    createGunzip: createGunzip,
    createUnzip: createUnzip,
    deflate: deflate,
    deflateSync: deflateSync,
    gzip: gzip,
    gzipSync: gzipSync,
    deflateRaw: deflateRaw,
    deflateRawSync: deflateRawSync,
    unzip: unzip,
    unzipSync: unzipSync,
    inflate: inflate,
    inflateSync: inflateSync,
    gunzip: gunzip,
    gunzipSync: gunzipSync,
    inflateRaw: inflateRaw,
    inflateRawSync: inflateRawSync,
    Deflate: Deflate,
    Inflate: Inflate,
    Gzip: Gzip,
    Gunzip: Gunzip,
    DeflateRaw: DeflateRaw,
    InflateRaw: InflateRaw,
    Unzip: Unzip,
    Zlib: Zlib
  };

  var _polyfillNode_zlib$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Deflate: Deflate,
    DeflateRaw: DeflateRaw,
    Gunzip: Gunzip,
    Gzip: Gzip,
    Inflate: Inflate,
    InflateRaw: InflateRaw,
    Unzip: Unzip,
    Zlib: Zlib,
    codes: codes,
    createDeflate: createDeflate,
    createDeflateRaw: createDeflateRaw,
    createGunzip: createGunzip,
    createGzip: createGzip,
    createInflate: createInflate,
    createInflateRaw: createInflateRaw,
    createUnzip: createUnzip,
    default: _polyfillNode_zlib,
    deflate: deflate,
    deflateRaw: deflateRaw,
    deflateRawSync: deflateRawSync,
    deflateSync: deflateSync,
    gunzip: gunzip,
    gunzipSync: gunzipSync,
    gzip: gzip,
    gzipSync: gzipSync,
    inflate: inflate,
    inflateRaw: inflateRaw,
    inflateRawSync: inflateRawSync,
    inflateSync: inflateSync,
    unzip: unzip,
    unzipSync: unzipSync
  });

  var require$$0$1 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_zlib$1);

  var chunkstream = {exports: {}};

  var hasRequiredChunkstream;

  function requireChunkstream () {
  	if (hasRequiredChunkstream) return chunkstream.exports;
  	hasRequiredChunkstream = 1;

  	let util = require$$0$2;
  	let Stream = require$$1;

  	let ChunkStream = (chunkstream.exports = function () {
  	  Stream.call(this);

  	  this._buffers = [];
  	  this._buffered = 0;

  	  this._reads = [];
  	  this._paused = false;

  	  this._encoding = "utf8";
  	  this.writable = true;
  	});
  	util.inherits(ChunkStream, Stream);

  	ChunkStream.prototype.read = function (length, callback) {
  	  this._reads.push({
  	    length: Math.abs(length), // if length < 0 then at most this length
  	    allowLess: length < 0,
  	    func: callback,
  	  });

  	  browser$1$1.nextTick(
  	    function () {
  	      this._process();

  	      // its paused and there is not enought data then ask for more
  	      if (this._paused && this._reads && this._reads.length > 0) {
  	        this._paused = false;

  	        this.emit("drain");
  	      }
  	    }.bind(this)
  	  );
  	};

  	ChunkStream.prototype.write = function (data, encoding) {
  	  if (!this.writable) {
  	    this.emit("error", new Error("Stream not writable"));
  	    return false;
  	  }

  	  let dataBuffer;
  	  if (Buffer.isBuffer(data)) {
  	    dataBuffer = data;
  	  } else {
  	    dataBuffer = Buffer.from(data, encoding || this._encoding);
  	  }

  	  this._buffers.push(dataBuffer);
  	  this._buffered += dataBuffer.length;

  	  this._process();

  	  // ok if there are no more read requests
  	  if (this._reads && this._reads.length === 0) {
  	    this._paused = true;
  	  }

  	  return this.writable && !this._paused;
  	};

  	ChunkStream.prototype.end = function (data, encoding) {
  	  if (data) {
  	    this.write(data, encoding);
  	  }

  	  this.writable = false;

  	  // already destroyed
  	  if (!this._buffers) {
  	    return;
  	  }

  	  // enqueue or handle end
  	  if (this._buffers.length === 0) {
  	    this._end();
  	  } else {
  	    this._buffers.push(null);
  	    this._process();
  	  }
  	};

  	ChunkStream.prototype.destroySoon = ChunkStream.prototype.end;

  	ChunkStream.prototype._end = function () {
  	  if (this._reads.length > 0) {
  	    this.emit("error", new Error("Unexpected end of input"));
  	  }

  	  this.destroy();
  	};

  	ChunkStream.prototype.destroy = function () {
  	  if (!this._buffers) {
  	    return;
  	  }

  	  this.writable = false;
  	  this._reads = null;
  	  this._buffers = null;

  	  this.emit("close");
  	};

  	ChunkStream.prototype._processReadAllowingLess = function (read) {
  	  // ok there is any data so that we can satisfy this request
  	  this._reads.shift(); // == read

  	  // first we need to peek into first buffer
  	  let smallerBuf = this._buffers[0];

  	  // ok there is more data than we need
  	  if (smallerBuf.length > read.length) {
  	    this._buffered -= read.length;
  	    this._buffers[0] = smallerBuf.slice(read.length);

  	    read.func.call(this, smallerBuf.slice(0, read.length));
  	  } else {
  	    // ok this is less than maximum length so use it all
  	    this._buffered -= smallerBuf.length;
  	    this._buffers.shift(); // == smallerBuf

  	    read.func.call(this, smallerBuf);
  	  }
  	};

  	ChunkStream.prototype._processRead = function (read) {
  	  this._reads.shift(); // == read

  	  let pos = 0;
  	  let count = 0;
  	  let data = Buffer.alloc(read.length);

  	  // create buffer for all data
  	  while (pos < read.length) {
  	    let buf = this._buffers[count++];
  	    let len = Math.min(buf.length, read.length - pos);

  	    buf.copy(data, pos, 0, len);
  	    pos += len;

  	    // last buffer wasn't used all so just slice it and leave
  	    if (len !== buf.length) {
  	      this._buffers[--count] = buf.slice(len);
  	    }
  	  }

  	  // remove all used buffers
  	  if (count > 0) {
  	    this._buffers.splice(0, count);
  	  }

  	  this._buffered -= read.length;

  	  read.func.call(this, data);
  	};

  	ChunkStream.prototype._process = function () {
  	  try {
  	    // as long as there is any data and read requests
  	    while (this._buffered > 0 && this._reads && this._reads.length > 0) {
  	      let read = this._reads[0];

  	      // read any data (but no more than length)
  	      if (read.allowLess) {
  	        this._processReadAllowingLess(read);
  	      } else if (this._buffered >= read.length) {
  	        // ok we can meet some expectations

  	        this._processRead(read);
  	      } else {
  	        // not enought data to satisfy first request in queue
  	        // so we need to wait for more
  	        break;
  	      }
  	    }

  	    if (this._buffers && !this.writable) {
  	      this._end();
  	    }
  	  } catch (ex) {
  	    this.emit("error", ex);
  	  }
  	};
  	return chunkstream.exports;
  }

  var filterParseAsync = {exports: {}};

  var filterParse = {exports: {}};

  var interlace = {};

  var hasRequiredInterlace;

  function requireInterlace () {
  	if (hasRequiredInterlace) return interlace;
  	hasRequiredInterlace = 1;

  	// Adam 7
  	//   0 1 2 3 4 5 6 7
  	// 0 x 6 4 6 x 6 4 6
  	// 1 7 7 7 7 7 7 7 7
  	// 2 5 6 5 6 5 6 5 6
  	// 3 7 7 7 7 7 7 7 7
  	// 4 3 6 4 6 3 6 4 6
  	// 5 7 7 7 7 7 7 7 7
  	// 6 5 6 5 6 5 6 5 6
  	// 7 7 7 7 7 7 7 7 7

  	let imagePasses = [
  	  {
  	    // pass 1 - 1px
  	    x: [0],
  	    y: [0],
  	  },
  	  {
  	    // pass 2 - 1px
  	    x: [4],
  	    y: [0],
  	  },
  	  {
  	    // pass 3 - 2px
  	    x: [0, 4],
  	    y: [4],
  	  },
  	  {
  	    // pass 4 - 4px
  	    x: [2, 6],
  	    y: [0, 4],
  	  },
  	  {
  	    // pass 5 - 8px
  	    x: [0, 2, 4, 6],
  	    y: [2, 6],
  	  },
  	  {
  	    // pass 6 - 16px
  	    x: [1, 3, 5, 7],
  	    y: [0, 2, 4, 6],
  	  },
  	  {
  	    // pass 7 - 32px
  	    x: [0, 1, 2, 3, 4, 5, 6, 7],
  	    y: [1, 3, 5, 7],
  	  },
  	];

  	interlace.getImagePasses = function (width, height) {
  	  let images = [];
  	  let xLeftOver = width % 8;
  	  let yLeftOver = height % 8;
  	  let xRepeats = (width - xLeftOver) / 8;
  	  let yRepeats = (height - yLeftOver) / 8;
  	  for (let i = 0; i < imagePasses.length; i++) {
  	    let pass = imagePasses[i];
  	    let passWidth = xRepeats * pass.x.length;
  	    let passHeight = yRepeats * pass.y.length;
  	    for (let j = 0; j < pass.x.length; j++) {
  	      if (pass.x[j] < xLeftOver) {
  	        passWidth++;
  	      } else {
  	        break;
  	      }
  	    }
  	    for (let j = 0; j < pass.y.length; j++) {
  	      if (pass.y[j] < yLeftOver) {
  	        passHeight++;
  	      } else {
  	        break;
  	      }
  	    }
  	    if (passWidth > 0 && passHeight > 0) {
  	      images.push({ width: passWidth, height: passHeight, index: i });
  	    }
  	  }
  	  return images;
  	};

  	interlace.getInterlaceIterator = function (width) {
  	  return function (x, y, pass) {
  	    let outerXLeftOver = x % imagePasses[pass].x.length;
  	    let outerX =
  	      ((x - outerXLeftOver) / imagePasses[pass].x.length) * 8 +
  	      imagePasses[pass].x[outerXLeftOver];
  	    let outerYLeftOver = y % imagePasses[pass].y.length;
  	    let outerY =
  	      ((y - outerYLeftOver) / imagePasses[pass].y.length) * 8 +
  	      imagePasses[pass].y[outerYLeftOver];
  	    return outerX * 4 + outerY * width * 4;
  	  };
  	};
  	return interlace;
  }

  var paethPredictor;
  var hasRequiredPaethPredictor;

  function requirePaethPredictor () {
  	if (hasRequiredPaethPredictor) return paethPredictor;
  	hasRequiredPaethPredictor = 1;

  	paethPredictor = function paethPredictor(left, above, upLeft) {
  	  let paeth = left + above - upLeft;
  	  let pLeft = Math.abs(paeth - left);
  	  let pAbove = Math.abs(paeth - above);
  	  let pUpLeft = Math.abs(paeth - upLeft);

  	  if (pLeft <= pAbove && pLeft <= pUpLeft) {
  	    return left;
  	  }
  	  if (pAbove <= pUpLeft) {
  	    return above;
  	  }
  	  return upLeft;
  	};
  	return paethPredictor;
  }

  var hasRequiredFilterParse;

  function requireFilterParse () {
  	if (hasRequiredFilterParse) return filterParse.exports;
  	hasRequiredFilterParse = 1;

  	let interlaceUtils = requireInterlace();
  	let paethPredictor = requirePaethPredictor();

  	function getByteWidth(width, bpp, depth) {
  	  let byteWidth = width * bpp;
  	  if (depth !== 8) {
  	    byteWidth = Math.ceil(byteWidth / (8 / depth));
  	  }
  	  return byteWidth;
  	}

  	let Filter = (filterParse.exports = function (bitmapInfo, dependencies) {
  	  let width = bitmapInfo.width;
  	  let height = bitmapInfo.height;
  	  let interlace = bitmapInfo.interlace;
  	  let bpp = bitmapInfo.bpp;
  	  let depth = bitmapInfo.depth;

  	  this.read = dependencies.read;
  	  this.write = dependencies.write;
  	  this.complete = dependencies.complete;

  	  this._imageIndex = 0;
  	  this._images = [];
  	  if (interlace) {
  	    let passes = interlaceUtils.getImagePasses(width, height);
  	    for (let i = 0; i < passes.length; i++) {
  	      this._images.push({
  	        byteWidth: getByteWidth(passes[i].width, bpp, depth),
  	        height: passes[i].height,
  	        lineIndex: 0,
  	      });
  	    }
  	  } else {
  	    this._images.push({
  	      byteWidth: getByteWidth(width, bpp, depth),
  	      height: height,
  	      lineIndex: 0,
  	    });
  	  }

  	  // when filtering the line we look at the pixel to the left
  	  // the spec also says it is done on a byte level regardless of the number of pixels
  	  // so if the depth is byte compatible (8 or 16) we subtract the bpp in order to compare back
  	  // a pixel rather than just a different byte part. However if we are sub byte, we ignore.
  	  if (depth === 8) {
  	    this._xComparison = bpp;
  	  } else if (depth === 16) {
  	    this._xComparison = bpp * 2;
  	  } else {
  	    this._xComparison = 1;
  	  }
  	});

  	Filter.prototype.start = function () {
  	  this.read(
  	    this._images[this._imageIndex].byteWidth + 1,
  	    this._reverseFilterLine.bind(this)
  	  );
  	};

  	Filter.prototype._unFilterType1 = function (
  	  rawData,
  	  unfilteredLine,
  	  byteWidth
  	) {
  	  let xComparison = this._xComparison;
  	  let xBiggerThan = xComparison - 1;

  	  for (let x = 0; x < byteWidth; x++) {
  	    let rawByte = rawData[1 + x];
  	    let f1Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
  	    unfilteredLine[x] = rawByte + f1Left;
  	  }
  	};

  	Filter.prototype._unFilterType2 = function (
  	  rawData,
  	  unfilteredLine,
  	  byteWidth
  	) {
  	  let lastLine = this._lastLine;

  	  for (let x = 0; x < byteWidth; x++) {
  	    let rawByte = rawData[1 + x];
  	    let f2Up = lastLine ? lastLine[x] : 0;
  	    unfilteredLine[x] = rawByte + f2Up;
  	  }
  	};

  	Filter.prototype._unFilterType3 = function (
  	  rawData,
  	  unfilteredLine,
  	  byteWidth
  	) {
  	  let xComparison = this._xComparison;
  	  let xBiggerThan = xComparison - 1;
  	  let lastLine = this._lastLine;

  	  for (let x = 0; x < byteWidth; x++) {
  	    let rawByte = rawData[1 + x];
  	    let f3Up = lastLine ? lastLine[x] : 0;
  	    let f3Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
  	    let f3Add = Math.floor((f3Left + f3Up) / 2);
  	    unfilteredLine[x] = rawByte + f3Add;
  	  }
  	};

  	Filter.prototype._unFilterType4 = function (
  	  rawData,
  	  unfilteredLine,
  	  byteWidth
  	) {
  	  let xComparison = this._xComparison;
  	  let xBiggerThan = xComparison - 1;
  	  let lastLine = this._lastLine;

  	  for (let x = 0; x < byteWidth; x++) {
  	    let rawByte = rawData[1 + x];
  	    let f4Up = lastLine ? lastLine[x] : 0;
  	    let f4Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
  	    let f4UpLeft = x > xBiggerThan && lastLine ? lastLine[x - xComparison] : 0;
  	    let f4Add = paethPredictor(f4Left, f4Up, f4UpLeft);
  	    unfilteredLine[x] = rawByte + f4Add;
  	  }
  	};

  	Filter.prototype._reverseFilterLine = function (rawData) {
  	  let filter = rawData[0];
  	  let unfilteredLine;
  	  let currentImage = this._images[this._imageIndex];
  	  let byteWidth = currentImage.byteWidth;

  	  if (filter === 0) {
  	    unfilteredLine = rawData.slice(1, byteWidth + 1);
  	  } else {
  	    unfilteredLine = Buffer.alloc(byteWidth);

  	    switch (filter) {
  	      case 1:
  	        this._unFilterType1(rawData, unfilteredLine, byteWidth);
  	        break;
  	      case 2:
  	        this._unFilterType2(rawData, unfilteredLine, byteWidth);
  	        break;
  	      case 3:
  	        this._unFilterType3(rawData, unfilteredLine, byteWidth);
  	        break;
  	      case 4:
  	        this._unFilterType4(rawData, unfilteredLine, byteWidth);
  	        break;
  	      default:
  	        throw new Error("Unrecognised filter type - " + filter);
  	    }
  	  }

  	  this.write(unfilteredLine);

  	  currentImage.lineIndex++;
  	  if (currentImage.lineIndex >= currentImage.height) {
  	    this._lastLine = null;
  	    this._imageIndex++;
  	    currentImage = this._images[this._imageIndex];
  	  } else {
  	    this._lastLine = unfilteredLine;
  	  }

  	  if (currentImage) {
  	    // read, using the byte width that may be from the new current image
  	    this.read(currentImage.byteWidth + 1, this._reverseFilterLine.bind(this));
  	  } else {
  	    this._lastLine = null;
  	    this.complete();
  	  }
  	};
  	return filterParse.exports;
  }

  var hasRequiredFilterParseAsync;

  function requireFilterParseAsync () {
  	if (hasRequiredFilterParseAsync) return filterParseAsync.exports;
  	hasRequiredFilterParseAsync = 1;

  	let util = require$$0$2;
  	let ChunkStream = requireChunkstream();
  	let Filter = requireFilterParse();

  	let FilterAsync = (filterParseAsync.exports = function (bitmapInfo) {
  	  ChunkStream.call(this);

  	  let buffers = [];
  	  let that = this;
  	  this._filter = new Filter(bitmapInfo, {
  	    read: this.read.bind(this),
  	    write: function (buffer) {
  	      buffers.push(buffer);
  	    },
  	    complete: function () {
  	      that.emit("complete", Buffer.concat(buffers));
  	    },
  	  });

  	  this._filter.start();
  	});
  	util.inherits(FilterAsync, ChunkStream);
  	return filterParseAsync.exports;
  }

  var parser = {exports: {}};

  var constants;
  var hasRequiredConstants;

  function requireConstants () {
  	if (hasRequiredConstants) return constants;
  	hasRequiredConstants = 1;

  	constants = {
  	  PNG_SIGNATURE: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],

  	  TYPE_IHDR: 0x49484452,
  	  TYPE_IEND: 0x49454e44,
  	  TYPE_IDAT: 0x49444154,
  	  TYPE_PLTE: 0x504c5445,
  	  TYPE_tRNS: 0x74524e53, // eslint-disable-line camelcase
  	  TYPE_gAMA: 0x67414d41, // eslint-disable-line camelcase

  	  // color-type bits
  	  COLORTYPE_GRAYSCALE: 0,
  	  COLORTYPE_PALETTE: 1,
  	  COLORTYPE_COLOR: 2,
  	  COLORTYPE_ALPHA: 4, // e.g. grayscale and alpha

  	  // color-type combinations
  	  COLORTYPE_PALETTE_COLOR: 3,
  	  COLORTYPE_COLOR_ALPHA: 6,

  	  COLORTYPE_TO_BPP_MAP: {
  	    0: 1,
  	    2: 3,
  	    3: 1,
  	    4: 2,
  	    6: 4,
  	  },

  	  GAMMA_DIVISION: 100000,
  	};
  	return constants;
  }

  var crc = {exports: {}};

  var hasRequiredCrc;

  function requireCrc () {
  	if (hasRequiredCrc) return crc.exports;
  	hasRequiredCrc = 1;

  	let crcTable = [];

  	(function () {
  	  for (let i = 0; i < 256; i++) {
  	    let currentCrc = i;
  	    for (let j = 0; j < 8; j++) {
  	      if (currentCrc & 1) {
  	        currentCrc = 0xedb88320 ^ (currentCrc >>> 1);
  	      } else {
  	        currentCrc = currentCrc >>> 1;
  	      }
  	    }
  	    crcTable[i] = currentCrc;
  	  }
  	})();

  	let CrcCalculator = (crc.exports = function () {
  	  this._crc = -1;
  	});

  	CrcCalculator.prototype.write = function (data) {
  	  for (let i = 0; i < data.length; i++) {
  	    this._crc = crcTable[(this._crc ^ data[i]) & 0xff] ^ (this._crc >>> 8);
  	  }
  	  return true;
  	};

  	CrcCalculator.prototype.crc32 = function () {
  	  return this._crc ^ -1;
  	};

  	CrcCalculator.crc32 = function (buf) {
  	  let crc = -1;
  	  for (let i = 0; i < buf.length; i++) {
  	    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  	  }
  	  return crc ^ -1;
  	};
  	return crc.exports;
  }

  var hasRequiredParser;

  function requireParser () {
  	if (hasRequiredParser) return parser.exports;
  	hasRequiredParser = 1;

  	let constants = requireConstants();
  	let CrcCalculator = requireCrc();

  	let Parser = (parser.exports = function (options, dependencies) {
  	  this._options = options;
  	  options.checkCRC = options.checkCRC !== false;

  	  this._hasIHDR = false;
  	  this._hasIEND = false;
  	  this._emittedHeadersFinished = false;

  	  // input flags/metadata
  	  this._palette = [];
  	  this._colorType = 0;

  	  this._chunks = {};
  	  this._chunks[constants.TYPE_IHDR] = this._handleIHDR.bind(this);
  	  this._chunks[constants.TYPE_IEND] = this._handleIEND.bind(this);
  	  this._chunks[constants.TYPE_IDAT] = this._handleIDAT.bind(this);
  	  this._chunks[constants.TYPE_PLTE] = this._handlePLTE.bind(this);
  	  this._chunks[constants.TYPE_tRNS] = this._handleTRNS.bind(this);
  	  this._chunks[constants.TYPE_gAMA] = this._handleGAMA.bind(this);

  	  this.read = dependencies.read;
  	  this.error = dependencies.error;
  	  this.metadata = dependencies.metadata;
  	  this.gamma = dependencies.gamma;
  	  this.transColor = dependencies.transColor;
  	  this.palette = dependencies.palette;
  	  this.parsed = dependencies.parsed;
  	  this.inflateData = dependencies.inflateData;
  	  this.finished = dependencies.finished;
  	  this.simpleTransparency = dependencies.simpleTransparency;
  	  this.headersFinished = dependencies.headersFinished || function () {};
  	});

  	Parser.prototype.start = function () {
  	  this.read(constants.PNG_SIGNATURE.length, this._parseSignature.bind(this));
  	};

  	Parser.prototype._parseSignature = function (data) {
  	  let signature = constants.PNG_SIGNATURE;

  	  for (let i = 0; i < signature.length; i++) {
  	    if (data[i] !== signature[i]) {
  	      this.error(new Error("Invalid file signature"));
  	      return;
  	    }
  	  }
  	  this.read(8, this._parseChunkBegin.bind(this));
  	};

  	Parser.prototype._parseChunkBegin = function (data) {
  	  // chunk content length
  	  let length = data.readUInt32BE(0);

  	  // chunk type
  	  let type = data.readUInt32BE(4);
  	  let name = "";
  	  for (let i = 4; i < 8; i++) {
  	    name += String.fromCharCode(data[i]);
  	  }

  	  //console.log('chunk ', name, length);

  	  // chunk flags
  	  let ancillary = Boolean(data[4] & 0x20); // or critical
  	  //    priv = Boolean(data[5] & 0x20), // or public
  	  //    safeToCopy = Boolean(data[7] & 0x20); // or unsafe

  	  if (!this._hasIHDR && type !== constants.TYPE_IHDR) {
  	    this.error(new Error("Expected IHDR on beggining"));
  	    return;
  	  }

  	  this._crc = new CrcCalculator();
  	  this._crc.write(Buffer.from(name));

  	  if (this._chunks[type]) {
  	    return this._chunks[type](length);
  	  }

  	  if (!ancillary) {
  	    this.error(new Error("Unsupported critical chunk type " + name));
  	    return;
  	  }

  	  this.read(length + 4, this._skipChunk.bind(this));
  	};

  	Parser.prototype._skipChunk = function (/*data*/) {
  	  this.read(8, this._parseChunkBegin.bind(this));
  	};

  	Parser.prototype._handleChunkEnd = function () {
  	  this.read(4, this._parseChunkEnd.bind(this));
  	};

  	Parser.prototype._parseChunkEnd = function (data) {
  	  let fileCrc = data.readInt32BE(0);
  	  let calcCrc = this._crc.crc32();

  	  // check CRC
  	  if (this._options.checkCRC && calcCrc !== fileCrc) {
  	    this.error(new Error("Crc error - " + fileCrc + " - " + calcCrc));
  	    return;
  	  }

  	  if (!this._hasIEND) {
  	    this.read(8, this._parseChunkBegin.bind(this));
  	  }
  	};

  	Parser.prototype._handleIHDR = function (length) {
  	  this.read(length, this._parseIHDR.bind(this));
  	};
  	Parser.prototype._parseIHDR = function (data) {
  	  this._crc.write(data);

  	  let width = data.readUInt32BE(0);
  	  let height = data.readUInt32BE(4);
  	  let depth = data[8];
  	  let colorType = data[9]; // bits: 1 palette, 2 color, 4 alpha
  	  let compr = data[10];
  	  let filter = data[11];
  	  let interlace = data[12];

  	  // console.log('    width', width, 'height', height,
  	  //     'depth', depth, 'colorType', colorType,
  	  //     'compr', compr, 'filter', filter, 'interlace', interlace
  	  // );

  	  if (
  	    depth !== 8 &&
  	    depth !== 4 &&
  	    depth !== 2 &&
  	    depth !== 1 &&
  	    depth !== 16
  	  ) {
  	    this.error(new Error("Unsupported bit depth " + depth));
  	    return;
  	  }
  	  if (!(colorType in constants.COLORTYPE_TO_BPP_MAP)) {
  	    this.error(new Error("Unsupported color type"));
  	    return;
  	  }
  	  if (compr !== 0) {
  	    this.error(new Error("Unsupported compression method"));
  	    return;
  	  }
  	  if (filter !== 0) {
  	    this.error(new Error("Unsupported filter method"));
  	    return;
  	  }
  	  if (interlace !== 0 && interlace !== 1) {
  	    this.error(new Error("Unsupported interlace method"));
  	    return;
  	  }

  	  this._colorType = colorType;

  	  let bpp = constants.COLORTYPE_TO_BPP_MAP[this._colorType];

  	  this._hasIHDR = true;

  	  this.metadata({
  	    width: width,
  	    height: height,
  	    depth: depth,
  	    interlace: Boolean(interlace),
  	    palette: Boolean(colorType & constants.COLORTYPE_PALETTE),
  	    color: Boolean(colorType & constants.COLORTYPE_COLOR),
  	    alpha: Boolean(colorType & constants.COLORTYPE_ALPHA),
  	    bpp: bpp,
  	    colorType: colorType,
  	  });

  	  this._handleChunkEnd();
  	};

  	Parser.prototype._handlePLTE = function (length) {
  	  this.read(length, this._parsePLTE.bind(this));
  	};
  	Parser.prototype._parsePLTE = function (data) {
  	  this._crc.write(data);

  	  let entries = Math.floor(data.length / 3);
  	  // console.log('Palette:', entries);

  	  for (let i = 0; i < entries; i++) {
  	    this._palette.push([data[i * 3], data[i * 3 + 1], data[i * 3 + 2], 0xff]);
  	  }

  	  this.palette(this._palette);

  	  this._handleChunkEnd();
  	};

  	Parser.prototype._handleTRNS = function (length) {
  	  this.simpleTransparency();
  	  this.read(length, this._parseTRNS.bind(this));
  	};
  	Parser.prototype._parseTRNS = function (data) {
  	  this._crc.write(data);

  	  // palette
  	  if (this._colorType === constants.COLORTYPE_PALETTE_COLOR) {
  	    if (this._palette.length === 0) {
  	      this.error(new Error("Transparency chunk must be after palette"));
  	      return;
  	    }
  	    if (data.length > this._palette.length) {
  	      this.error(new Error("More transparent colors than palette size"));
  	      return;
  	    }
  	    for (let i = 0; i < data.length; i++) {
  	      this._palette[i][3] = data[i];
  	    }
  	    this.palette(this._palette);
  	  }

  	  // for colorType 0 (grayscale) and 2 (rgb)
  	  // there might be one gray/color defined as transparent
  	  if (this._colorType === constants.COLORTYPE_GRAYSCALE) {
  	    // grey, 2 bytes
  	    this.transColor([data.readUInt16BE(0)]);
  	  }
  	  if (this._colorType === constants.COLORTYPE_COLOR) {
  	    this.transColor([
  	      data.readUInt16BE(0),
  	      data.readUInt16BE(2),
  	      data.readUInt16BE(4),
  	    ]);
  	  }

  	  this._handleChunkEnd();
  	};

  	Parser.prototype._handleGAMA = function (length) {
  	  this.read(length, this._parseGAMA.bind(this));
  	};
  	Parser.prototype._parseGAMA = function (data) {
  	  this._crc.write(data);
  	  this.gamma(data.readUInt32BE(0) / constants.GAMMA_DIVISION);

  	  this._handleChunkEnd();
  	};

  	Parser.prototype._handleIDAT = function (length) {
  	  if (!this._emittedHeadersFinished) {
  	    this._emittedHeadersFinished = true;
  	    this.headersFinished();
  	  }
  	  this.read(-length, this._parseIDAT.bind(this, length));
  	};
  	Parser.prototype._parseIDAT = function (length, data) {
  	  this._crc.write(data);

  	  if (
  	    this._colorType === constants.COLORTYPE_PALETTE_COLOR &&
  	    this._palette.length === 0
  	  ) {
  	    throw new Error("Expected palette not found");
  	  }

  	  this.inflateData(data);
  	  let leftOverLength = length - data.length;

  	  if (leftOverLength > 0) {
  	    this._handleIDAT(leftOverLength);
  	  } else {
  	    this._handleChunkEnd();
  	  }
  	};

  	Parser.prototype._handleIEND = function (length) {
  	  this.read(length, this._parseIEND.bind(this));
  	};
  	Parser.prototype._parseIEND = function (data) {
  	  this._crc.write(data);

  	  this._hasIEND = true;
  	  this._handleChunkEnd();

  	  if (this.finished) {
  	    this.finished();
  	  }
  	};
  	return parser.exports;
  }

  var bitmapper = {};

  var hasRequiredBitmapper;

  function requireBitmapper () {
  	if (hasRequiredBitmapper) return bitmapper;
  	hasRequiredBitmapper = 1;

  	let interlaceUtils = requireInterlace();

  	let pixelBppMapper = [
  	  // 0 - dummy entry
  	  function () {},

  	  // 1 - L
  	  // 0: 0, 1: 0, 2: 0, 3: 0xff
  	  function (pxData, data, pxPos, rawPos) {
  	    if (rawPos === data.length) {
  	      throw new Error("Ran out of data");
  	    }

  	    let pixel = data[rawPos];
  	    pxData[pxPos] = pixel;
  	    pxData[pxPos + 1] = pixel;
  	    pxData[pxPos + 2] = pixel;
  	    pxData[pxPos + 3] = 0xff;
  	  },

  	  // 2 - LA
  	  // 0: 0, 1: 0, 2: 0, 3: 1
  	  function (pxData, data, pxPos, rawPos) {
  	    if (rawPos + 1 >= data.length) {
  	      throw new Error("Ran out of data");
  	    }

  	    let pixel = data[rawPos];
  	    pxData[pxPos] = pixel;
  	    pxData[pxPos + 1] = pixel;
  	    pxData[pxPos + 2] = pixel;
  	    pxData[pxPos + 3] = data[rawPos + 1];
  	  },

  	  // 3 - RGB
  	  // 0: 0, 1: 1, 2: 2, 3: 0xff
  	  function (pxData, data, pxPos, rawPos) {
  	    if (rawPos + 2 >= data.length) {
  	      throw new Error("Ran out of data");
  	    }

  	    pxData[pxPos] = data[rawPos];
  	    pxData[pxPos + 1] = data[rawPos + 1];
  	    pxData[pxPos + 2] = data[rawPos + 2];
  	    pxData[pxPos + 3] = 0xff;
  	  },

  	  // 4 - RGBA
  	  // 0: 0, 1: 1, 2: 2, 3: 3
  	  function (pxData, data, pxPos, rawPos) {
  	    if (rawPos + 3 >= data.length) {
  	      throw new Error("Ran out of data");
  	    }

  	    pxData[pxPos] = data[rawPos];
  	    pxData[pxPos + 1] = data[rawPos + 1];
  	    pxData[pxPos + 2] = data[rawPos + 2];
  	    pxData[pxPos + 3] = data[rawPos + 3];
  	  },
  	];

  	let pixelBppCustomMapper = [
  	  // 0 - dummy entry
  	  function () {},

  	  // 1 - L
  	  // 0: 0, 1: 0, 2: 0, 3: 0xff
  	  function (pxData, pixelData, pxPos, maxBit) {
  	    let pixel = pixelData[0];
  	    pxData[pxPos] = pixel;
  	    pxData[pxPos + 1] = pixel;
  	    pxData[pxPos + 2] = pixel;
  	    pxData[pxPos + 3] = maxBit;
  	  },

  	  // 2 - LA
  	  // 0: 0, 1: 0, 2: 0, 3: 1
  	  function (pxData, pixelData, pxPos) {
  	    let pixel = pixelData[0];
  	    pxData[pxPos] = pixel;
  	    pxData[pxPos + 1] = pixel;
  	    pxData[pxPos + 2] = pixel;
  	    pxData[pxPos + 3] = pixelData[1];
  	  },

  	  // 3 - RGB
  	  // 0: 0, 1: 1, 2: 2, 3: 0xff
  	  function (pxData, pixelData, pxPos, maxBit) {
  	    pxData[pxPos] = pixelData[0];
  	    pxData[pxPos + 1] = pixelData[1];
  	    pxData[pxPos + 2] = pixelData[2];
  	    pxData[pxPos + 3] = maxBit;
  	  },

  	  // 4 - RGBA
  	  // 0: 0, 1: 1, 2: 2, 3: 3
  	  function (pxData, pixelData, pxPos) {
  	    pxData[pxPos] = pixelData[0];
  	    pxData[pxPos + 1] = pixelData[1];
  	    pxData[pxPos + 2] = pixelData[2];
  	    pxData[pxPos + 3] = pixelData[3];
  	  },
  	];

  	function bitRetriever(data, depth) {
  	  let leftOver = [];
  	  let i = 0;

  	  function split() {
  	    if (i === data.length) {
  	      throw new Error("Ran out of data");
  	    }
  	    let byte = data[i];
  	    i++;
  	    let byte8, byte7, byte6, byte5, byte4, byte3, byte2, byte1;
  	    switch (depth) {
  	      default:
  	        throw new Error("unrecognised depth");
  	      case 16:
  	        byte2 = data[i];
  	        i++;
  	        leftOver.push((byte << 8) + byte2);
  	        break;
  	      case 4:
  	        byte2 = byte & 0x0f;
  	        byte1 = byte >> 4;
  	        leftOver.push(byte1, byte2);
  	        break;
  	      case 2:
  	        byte4 = byte & 3;
  	        byte3 = (byte >> 2) & 3;
  	        byte2 = (byte >> 4) & 3;
  	        byte1 = (byte >> 6) & 3;
  	        leftOver.push(byte1, byte2, byte3, byte4);
  	        break;
  	      case 1:
  	        byte8 = byte & 1;
  	        byte7 = (byte >> 1) & 1;
  	        byte6 = (byte >> 2) & 1;
  	        byte5 = (byte >> 3) & 1;
  	        byte4 = (byte >> 4) & 1;
  	        byte3 = (byte >> 5) & 1;
  	        byte2 = (byte >> 6) & 1;
  	        byte1 = (byte >> 7) & 1;
  	        leftOver.push(byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8);
  	        break;
  	    }
  	  }

  	  return {
  	    get: function (count) {
  	      while (leftOver.length < count) {
  	        split();
  	      }
  	      let returner = leftOver.slice(0, count);
  	      leftOver = leftOver.slice(count);
  	      return returner;
  	    },
  	    resetAfterLine: function () {
  	      leftOver.length = 0;
  	    },
  	    end: function () {
  	      if (i !== data.length) {
  	        throw new Error("extra data found");
  	      }
  	    },
  	  };
  	}

  	function mapImage8Bit(image, pxData, getPxPos, bpp, data, rawPos) {
  	  // eslint-disable-line max-params
  	  let imageWidth = image.width;
  	  let imageHeight = image.height;
  	  let imagePass = image.index;
  	  for (let y = 0; y < imageHeight; y++) {
  	    for (let x = 0; x < imageWidth; x++) {
  	      let pxPos = getPxPos(x, y, imagePass);
  	      pixelBppMapper[bpp](pxData, data, pxPos, rawPos);
  	      rawPos += bpp; //eslint-disable-line no-param-reassign
  	    }
  	  }
  	  return rawPos;
  	}

  	function mapImageCustomBit(image, pxData, getPxPos, bpp, bits, maxBit) {
  	  // eslint-disable-line max-params
  	  let imageWidth = image.width;
  	  let imageHeight = image.height;
  	  let imagePass = image.index;
  	  for (let y = 0; y < imageHeight; y++) {
  	    for (let x = 0; x < imageWidth; x++) {
  	      let pixelData = bits.get(bpp);
  	      let pxPos = getPxPos(x, y, imagePass);
  	      pixelBppCustomMapper[bpp](pxData, pixelData, pxPos, maxBit);
  	    }
  	    bits.resetAfterLine();
  	  }
  	}

  	bitmapper.dataToBitMap = function (data, bitmapInfo) {
  	  let width = bitmapInfo.width;
  	  let height = bitmapInfo.height;
  	  let depth = bitmapInfo.depth;
  	  let bpp = bitmapInfo.bpp;
  	  let interlace = bitmapInfo.interlace;
  	  let bits;

  	  if (depth !== 8) {
  	    bits = bitRetriever(data, depth);
  	  }
  	  let pxData;
  	  if (depth <= 8) {
  	    pxData = Buffer.alloc(width * height * 4);
  	  } else {
  	    pxData = new Uint16Array(width * height * 4);
  	  }
  	  let maxBit = Math.pow(2, depth) - 1;
  	  let rawPos = 0;
  	  let images;
  	  let getPxPos;

  	  if (interlace) {
  	    images = interlaceUtils.getImagePasses(width, height);
  	    getPxPos = interlaceUtils.getInterlaceIterator(width, height);
  	  } else {
  	    let nonInterlacedPxPos = 0;
  	    getPxPos = function () {
  	      let returner = nonInterlacedPxPos;
  	      nonInterlacedPxPos += 4;
  	      return returner;
  	    };
  	    images = [{ width: width, height: height }];
  	  }

  	  for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
  	    if (depth === 8) {
  	      rawPos = mapImage8Bit(
  	        images[imageIndex],
  	        pxData,
  	        getPxPos,
  	        bpp,
  	        data,
  	        rawPos
  	      );
  	    } else {
  	      mapImageCustomBit(
  	        images[imageIndex],
  	        pxData,
  	        getPxPos,
  	        bpp,
  	        bits,
  	        maxBit
  	      );
  	    }
  	  }
  	  if (depth === 8) {
  	    if (rawPos !== data.length) {
  	      throw new Error("extra data found");
  	    }
  	  } else {
  	    bits.end();
  	  }

  	  return pxData;
  	};
  	return bitmapper;
  }

  var formatNormaliser;
  var hasRequiredFormatNormaliser;

  function requireFormatNormaliser () {
  	if (hasRequiredFormatNormaliser) return formatNormaliser;
  	hasRequiredFormatNormaliser = 1;

  	function dePalette(indata, outdata, width, height, palette) {
  	  let pxPos = 0;
  	  // use values from palette
  	  for (let y = 0; y < height; y++) {
  	    for (let x = 0; x < width; x++) {
  	      let color = palette[indata[pxPos]];

  	      if (!color) {
  	        throw new Error("index " + indata[pxPos] + " not in palette");
  	      }

  	      for (let i = 0; i < 4; i++) {
  	        outdata[pxPos + i] = color[i];
  	      }
  	      pxPos += 4;
  	    }
  	  }
  	}

  	function replaceTransparentColor(indata, outdata, width, height, transColor) {
  	  let pxPos = 0;
  	  for (let y = 0; y < height; y++) {
  	    for (let x = 0; x < width; x++) {
  	      let makeTrans = false;

  	      if (transColor.length === 1) {
  	        if (transColor[0] === indata[pxPos]) {
  	          makeTrans = true;
  	        }
  	      } else if (
  	        transColor[0] === indata[pxPos] &&
  	        transColor[1] === indata[pxPos + 1] &&
  	        transColor[2] === indata[pxPos + 2]
  	      ) {
  	        makeTrans = true;
  	      }
  	      if (makeTrans) {
  	        for (let i = 0; i < 4; i++) {
  	          outdata[pxPos + i] = 0;
  	        }
  	      }
  	      pxPos += 4;
  	    }
  	  }
  	}

  	function scaleDepth(indata, outdata, width, height, depth) {
  	  let maxOutSample = 255;
  	  let maxInSample = Math.pow(2, depth) - 1;
  	  let pxPos = 0;

  	  for (let y = 0; y < height; y++) {
  	    for (let x = 0; x < width; x++) {
  	      for (let i = 0; i < 4; i++) {
  	        outdata[pxPos + i] = Math.floor(
  	          (indata[pxPos + i] * maxOutSample) / maxInSample + 0.5
  	        );
  	      }
  	      pxPos += 4;
  	    }
  	  }
  	}

  	formatNormaliser = function (indata, imageData, skipRescale = false) {
  	  let depth = imageData.depth;
  	  let width = imageData.width;
  	  let height = imageData.height;
  	  let colorType = imageData.colorType;
  	  let transColor = imageData.transColor;
  	  let palette = imageData.palette;

  	  let outdata = indata; // only different for 16 bits

  	  if (colorType === 3) {
  	    // paletted
  	    dePalette(indata, outdata, width, height, palette);
  	  } else {
  	    if (transColor) {
  	      replaceTransparentColor(indata, outdata, width, height, transColor);
  	    }
  	    // if it needs scaling
  	    if (depth !== 8 && !skipRescale) {
  	      // if we need to change the buffer size
  	      if (depth === 16) {
  	        outdata = Buffer.alloc(width * height * 4);
  	      }
  	      scaleDepth(indata, outdata, width, height, depth);
  	    }
  	  }
  	  return outdata;
  	};
  	return formatNormaliser;
  }

  var hasRequiredParserAsync;

  function requireParserAsync () {
  	if (hasRequiredParserAsync) return parserAsync.exports;
  	hasRequiredParserAsync = 1;

  	let util = require$$0$2;
  	let zlib = require$$0$1;
  	let ChunkStream = requireChunkstream();
  	let FilterAsync = requireFilterParseAsync();
  	let Parser = requireParser();
  	let bitmapper = requireBitmapper();
  	let formatNormaliser = requireFormatNormaliser();

  	let ParserAsync = (parserAsync.exports = function (options) {
  	  ChunkStream.call(this);

  	  this._parser = new Parser(options, {
  	    read: this.read.bind(this),
  	    error: this._handleError.bind(this),
  	    metadata: this._handleMetaData.bind(this),
  	    gamma: this.emit.bind(this, "gamma"),
  	    palette: this._handlePalette.bind(this),
  	    transColor: this._handleTransColor.bind(this),
  	    finished: this._finished.bind(this),
  	    inflateData: this._inflateData.bind(this),
  	    simpleTransparency: this._simpleTransparency.bind(this),
  	    headersFinished: this._headersFinished.bind(this),
  	  });
  	  this._options = options;
  	  this.writable = true;

  	  this._parser.start();
  	});
  	util.inherits(ParserAsync, ChunkStream);

  	ParserAsync.prototype._handleError = function (err) {
  	  this.emit("error", err);

  	  this.writable = false;

  	  this.destroy();

  	  if (this._inflate && this._inflate.destroy) {
  	    this._inflate.destroy();
  	  }

  	  if (this._filter) {
  	    this._filter.destroy();
  	    // For backward compatibility with Node 7 and below.
  	    // Suppress errors due to _inflate calling write() even after
  	    // it's destroy()'ed.
  	    this._filter.on("error", function () {});
  	  }

  	  this.errord = true;
  	};

  	ParserAsync.prototype._inflateData = function (data) {
  	  if (!this._inflate) {
  	    if (this._bitmapInfo.interlace) {
  	      this._inflate = zlib.createInflate();

  	      this._inflate.on("error", this.emit.bind(this, "error"));
  	      this._filter.on("complete", this._complete.bind(this));

  	      this._inflate.pipe(this._filter);
  	    } else {
  	      let rowSize =
  	        ((this._bitmapInfo.width *
  	          this._bitmapInfo.bpp *
  	          this._bitmapInfo.depth +
  	          7) >>
  	          3) +
  	        1;
  	      let imageSize = rowSize * this._bitmapInfo.height;
  	      let chunkSize = Math.max(imageSize, zlib.Z_MIN_CHUNK);

  	      this._inflate = zlib.createInflate({ chunkSize: chunkSize });
  	      let leftToInflate = imageSize;

  	      let emitError = this.emit.bind(this, "error");
  	      this._inflate.on("error", function (err) {
  	        if (!leftToInflate) {
  	          return;
  	        }

  	        emitError(err);
  	      });
  	      this._filter.on("complete", this._complete.bind(this));

  	      let filterWrite = this._filter.write.bind(this._filter);
  	      this._inflate.on("data", function (chunk) {
  	        if (!leftToInflate) {
  	          return;
  	        }

  	        if (chunk.length > leftToInflate) {
  	          chunk = chunk.slice(0, leftToInflate);
  	        }

  	        leftToInflate -= chunk.length;

  	        filterWrite(chunk);
  	      });

  	      this._inflate.on("end", this._filter.end.bind(this._filter));
  	    }
  	  }
  	  this._inflate.write(data);
  	};

  	ParserAsync.prototype._handleMetaData = function (metaData) {
  	  this._metaData = metaData;
  	  this._bitmapInfo = Object.create(metaData);

  	  this._filter = new FilterAsync(this._bitmapInfo);
  	};

  	ParserAsync.prototype._handleTransColor = function (transColor) {
  	  this._bitmapInfo.transColor = transColor;
  	};

  	ParserAsync.prototype._handlePalette = function (palette) {
  	  this._bitmapInfo.palette = palette;
  	};

  	ParserAsync.prototype._simpleTransparency = function () {
  	  this._metaData.alpha = true;
  	};

  	ParserAsync.prototype._headersFinished = function () {
  	  // Up until this point, we don't know if we have a tRNS chunk (alpha)
  	  // so we can't emit metadata any earlier
  	  this.emit("metadata", this._metaData);
  	};

  	ParserAsync.prototype._finished = function () {
  	  if (this.errord) {
  	    return;
  	  }

  	  if (!this._inflate) {
  	    this.emit("error", "No Inflate block");
  	  } else {
  	    // no more data to inflate
  	    this._inflate.end();
  	  }
  	};

  	ParserAsync.prototype._complete = function (filteredData) {
  	  if (this.errord) {
  	    return;
  	  }

  	  let normalisedBitmapData;

  	  try {
  	    let bitmapData = bitmapper.dataToBitMap(filteredData, this._bitmapInfo);

  	    normalisedBitmapData = formatNormaliser(
  	      bitmapData,
  	      this._bitmapInfo,
  	      this._options.skipRescale
  	    );
  	    bitmapData = null;
  	  } catch (ex) {
  	    this._handleError(ex);
  	    return;
  	  }

  	  this.emit("parsed", normalisedBitmapData);
  	};
  	return parserAsync.exports;
  }

  var packerAsync = {exports: {}};

  var packer = {exports: {}};

  var bitpacker;
  var hasRequiredBitpacker;

  function requireBitpacker () {
  	if (hasRequiredBitpacker) return bitpacker;
  	hasRequiredBitpacker = 1;

  	let constants = requireConstants();

  	bitpacker = function (dataIn, width, height, options) {
  	  let outHasAlpha =
  	    [constants.COLORTYPE_COLOR_ALPHA, constants.COLORTYPE_ALPHA].indexOf(
  	      options.colorType
  	    ) !== -1;
  	  if (options.colorType === options.inputColorType) {
  	    let bigEndian = (function () {
  	      let buffer = new ArrayBuffer(2);
  	      new DataView(buffer).setInt16(0, 256, true /* littleEndian */);
  	      // Int16Array uses the platform's endianness.
  	      return new Int16Array(buffer)[0] !== 256;
  	    })();
  	    // If no need to convert to grayscale and alpha is present/absent in both, take a fast route
  	    if (options.bitDepth === 8 || (options.bitDepth === 16 && bigEndian)) {
  	      return dataIn;
  	    }
  	  }

  	  // map to a UInt16 array if data is 16bit, fix endianness below
  	  let data = options.bitDepth !== 16 ? dataIn : new Uint16Array(dataIn.buffer);

  	  let maxValue = 255;
  	  let inBpp = constants.COLORTYPE_TO_BPP_MAP[options.inputColorType];
  	  if (inBpp === 4 && !options.inputHasAlpha) {
  	    inBpp = 3;
  	  }
  	  let outBpp = constants.COLORTYPE_TO_BPP_MAP[options.colorType];
  	  if (options.bitDepth === 16) {
  	    maxValue = 65535;
  	    outBpp *= 2;
  	  }
  	  let outData = Buffer.alloc(width * height * outBpp);

  	  let inIndex = 0;
  	  let outIndex = 0;

  	  let bgColor = options.bgColor || {};
  	  if (bgColor.red === undefined) {
  	    bgColor.red = maxValue;
  	  }
  	  if (bgColor.green === undefined) {
  	    bgColor.green = maxValue;
  	  }
  	  if (bgColor.blue === undefined) {
  	    bgColor.blue = maxValue;
  	  }

  	  function getRGBA() {
  	    let red;
  	    let green;
  	    let blue;
  	    let alpha = maxValue;
  	    switch (options.inputColorType) {
  	      case constants.COLORTYPE_COLOR_ALPHA:
  	        alpha = data[inIndex + 3];
  	        red = data[inIndex];
  	        green = data[inIndex + 1];
  	        blue = data[inIndex + 2];
  	        break;
  	      case constants.COLORTYPE_COLOR:
  	        red = data[inIndex];
  	        green = data[inIndex + 1];
  	        blue = data[inIndex + 2];
  	        break;
  	      case constants.COLORTYPE_ALPHA:
  	        alpha = data[inIndex + 1];
  	        red = data[inIndex];
  	        green = red;
  	        blue = red;
  	        break;
  	      case constants.COLORTYPE_GRAYSCALE:
  	        red = data[inIndex];
  	        green = red;
  	        blue = red;
  	        break;
  	      default:
  	        throw new Error(
  	          "input color type:" +
  	            options.inputColorType +
  	            " is not supported at present"
  	        );
  	    }

  	    if (options.inputHasAlpha) {
  	      if (!outHasAlpha) {
  	        alpha /= maxValue;
  	        red = Math.min(
  	          Math.max(Math.round((1 - alpha) * bgColor.red + alpha * red), 0),
  	          maxValue
  	        );
  	        green = Math.min(
  	          Math.max(Math.round((1 - alpha) * bgColor.green + alpha * green), 0),
  	          maxValue
  	        );
  	        blue = Math.min(
  	          Math.max(Math.round((1 - alpha) * bgColor.blue + alpha * blue), 0),
  	          maxValue
  	        );
  	      }
  	    }
  	    return { red: red, green: green, blue: blue, alpha: alpha };
  	  }

  	  for (let y = 0; y < height; y++) {
  	    for (let x = 0; x < width; x++) {
  	      let rgba = getRGBA();

  	      switch (options.colorType) {
  	        case constants.COLORTYPE_COLOR_ALPHA:
  	        case constants.COLORTYPE_COLOR:
  	          if (options.bitDepth === 8) {
  	            outData[outIndex] = rgba.red;
  	            outData[outIndex + 1] = rgba.green;
  	            outData[outIndex + 2] = rgba.blue;
  	            if (outHasAlpha) {
  	              outData[outIndex + 3] = rgba.alpha;
  	            }
  	          } else {
  	            outData.writeUInt16BE(rgba.red, outIndex);
  	            outData.writeUInt16BE(rgba.green, outIndex + 2);
  	            outData.writeUInt16BE(rgba.blue, outIndex + 4);
  	            if (outHasAlpha) {
  	              outData.writeUInt16BE(rgba.alpha, outIndex + 6);
  	            }
  	          }
  	          break;
  	        case constants.COLORTYPE_ALPHA:
  	        case constants.COLORTYPE_GRAYSCALE: {
  	          // Convert to grayscale and alpha
  	          let grayscale = (rgba.red + rgba.green + rgba.blue) / 3;
  	          if (options.bitDepth === 8) {
  	            outData[outIndex] = grayscale;
  	            if (outHasAlpha) {
  	              outData[outIndex + 1] = rgba.alpha;
  	            }
  	          } else {
  	            outData.writeUInt16BE(grayscale, outIndex);
  	            if (outHasAlpha) {
  	              outData.writeUInt16BE(rgba.alpha, outIndex + 2);
  	            }
  	          }
  	          break;
  	        }
  	        default:
  	          throw new Error("unrecognised color Type " + options.colorType);
  	      }

  	      inIndex += inBpp;
  	      outIndex += outBpp;
  	    }
  	  }

  	  return outData;
  	};
  	return bitpacker;
  }

  var filterPack;
  var hasRequiredFilterPack;

  function requireFilterPack () {
  	if (hasRequiredFilterPack) return filterPack;
  	hasRequiredFilterPack = 1;

  	let paethPredictor = requirePaethPredictor();

  	function filterNone(pxData, pxPos, byteWidth, rawData, rawPos) {
  	  for (let x = 0; x < byteWidth; x++) {
  	    rawData[rawPos + x] = pxData[pxPos + x];
  	  }
  	}

  	function filterSumNone(pxData, pxPos, byteWidth) {
  	  let sum = 0;
  	  let length = pxPos + byteWidth;

  	  for (let i = pxPos; i < length; i++) {
  	    sum += Math.abs(pxData[i]);
  	  }
  	  return sum;
  	}

  	function filterSub(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
  	  for (let x = 0; x < byteWidth; x++) {
  	    let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
  	    let val = pxData[pxPos + x] - left;

  	    rawData[rawPos + x] = val;
  	  }
  	}

  	function filterSumSub(pxData, pxPos, byteWidth, bpp) {
  	  let sum = 0;
  	  for (let x = 0; x < byteWidth; x++) {
  	    let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
  	    let val = pxData[pxPos + x] - left;

  	    sum += Math.abs(val);
  	  }

  	  return sum;
  	}

  	function filterUp(pxData, pxPos, byteWidth, rawData, rawPos) {
  	  for (let x = 0; x < byteWidth; x++) {
  	    let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
  	    let val = pxData[pxPos + x] - up;

  	    rawData[rawPos + x] = val;
  	  }
  	}

  	function filterSumUp(pxData, pxPos, byteWidth) {
  	  let sum = 0;
  	  let length = pxPos + byteWidth;
  	  for (let x = pxPos; x < length; x++) {
  	    let up = pxPos > 0 ? pxData[x - byteWidth] : 0;
  	    let val = pxData[x] - up;

  	    sum += Math.abs(val);
  	  }

  	  return sum;
  	}

  	function filterAvg(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
  	  for (let x = 0; x < byteWidth; x++) {
  	    let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
  	    let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
  	    let val = pxData[pxPos + x] - ((left + up) >> 1);

  	    rawData[rawPos + x] = val;
  	  }
  	}

  	function filterSumAvg(pxData, pxPos, byteWidth, bpp) {
  	  let sum = 0;
  	  for (let x = 0; x < byteWidth; x++) {
  	    let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
  	    let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
  	    let val = pxData[pxPos + x] - ((left + up) >> 1);

  	    sum += Math.abs(val);
  	  }

  	  return sum;
  	}

  	function filterPaeth(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
  	  for (let x = 0; x < byteWidth; x++) {
  	    let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
  	    let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
  	    let upleft =
  	      pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
  	    let val = pxData[pxPos + x] - paethPredictor(left, up, upleft);

  	    rawData[rawPos + x] = val;
  	  }
  	}

  	function filterSumPaeth(pxData, pxPos, byteWidth, bpp) {
  	  let sum = 0;
  	  for (let x = 0; x < byteWidth; x++) {
  	    let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
  	    let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
  	    let upleft =
  	      pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
  	    let val = pxData[pxPos + x] - paethPredictor(left, up, upleft);

  	    sum += Math.abs(val);
  	  }

  	  return sum;
  	}

  	let filters = {
  	  0: filterNone,
  	  1: filterSub,
  	  2: filterUp,
  	  3: filterAvg,
  	  4: filterPaeth,
  	};

  	let filterSums = {
  	  0: filterSumNone,
  	  1: filterSumSub,
  	  2: filterSumUp,
  	  3: filterSumAvg,
  	  4: filterSumPaeth,
  	};

  	filterPack = function (pxData, width, height, options, bpp) {
  	  let filterTypes;
  	  if (!("filterType" in options) || options.filterType === -1) {
  	    filterTypes = [0, 1, 2, 3, 4];
  	  } else if (typeof options.filterType === "number") {
  	    filterTypes = [options.filterType];
  	  } else {
  	    throw new Error("unrecognised filter types");
  	  }

  	  if (options.bitDepth === 16) {
  	    bpp *= 2;
  	  }
  	  let byteWidth = width * bpp;
  	  let rawPos = 0;
  	  let pxPos = 0;
  	  let rawData = Buffer.alloc((byteWidth + 1) * height);

  	  let sel = filterTypes[0];

  	  for (let y = 0; y < height; y++) {
  	    if (filterTypes.length > 1) {
  	      // find best filter for this line (with lowest sum of values)
  	      let min = Infinity;

  	      for (let i = 0; i < filterTypes.length; i++) {
  	        let sum = filterSums[filterTypes[i]](pxData, pxPos, byteWidth, bpp);
  	        if (sum < min) {
  	          sel = filterTypes[i];
  	          min = sum;
  	        }
  	      }
  	    }

  	    rawData[rawPos] = sel;
  	    rawPos++;
  	    filters[sel](pxData, pxPos, byteWidth, rawData, rawPos, bpp);
  	    rawPos += byteWidth;
  	    pxPos += byteWidth;
  	  }
  	  return rawData;
  	};
  	return filterPack;
  }

  var hasRequiredPacker;

  function requirePacker () {
  	if (hasRequiredPacker) return packer.exports;
  	hasRequiredPacker = 1;

  	let constants = requireConstants();
  	let CrcStream = requireCrc();
  	let bitPacker = requireBitpacker();
  	let filter = requireFilterPack();
  	let zlib = require$$0$1;

  	let Packer = (packer.exports = function (options) {
  	  this._options = options;

  	  options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
  	  options.deflateLevel =
  	    options.deflateLevel != null ? options.deflateLevel : 9;
  	  options.deflateStrategy =
  	    options.deflateStrategy != null ? options.deflateStrategy : 3;
  	  options.inputHasAlpha =
  	    options.inputHasAlpha != null ? options.inputHasAlpha : true;
  	  options.deflateFactory = options.deflateFactory || zlib.createDeflate;
  	  options.bitDepth = options.bitDepth || 8;
  	  // This is outputColorType
  	  options.colorType =
  	    typeof options.colorType === "number"
  	      ? options.colorType
  	      : constants.COLORTYPE_COLOR_ALPHA;
  	  options.inputColorType =
  	    typeof options.inputColorType === "number"
  	      ? options.inputColorType
  	      : constants.COLORTYPE_COLOR_ALPHA;

  	  if (
  	    [
  	      constants.COLORTYPE_GRAYSCALE,
  	      constants.COLORTYPE_COLOR,
  	      constants.COLORTYPE_COLOR_ALPHA,
  	      constants.COLORTYPE_ALPHA,
  	    ].indexOf(options.colorType) === -1
  	  ) {
  	    throw new Error(
  	      "option color type:" + options.colorType + " is not supported at present"
  	    );
  	  }
  	  if (
  	    [
  	      constants.COLORTYPE_GRAYSCALE,
  	      constants.COLORTYPE_COLOR,
  	      constants.COLORTYPE_COLOR_ALPHA,
  	      constants.COLORTYPE_ALPHA,
  	    ].indexOf(options.inputColorType) === -1
  	  ) {
  	    throw new Error(
  	      "option input color type:" +
  	        options.inputColorType +
  	        " is not supported at present"
  	    );
  	  }
  	  if (options.bitDepth !== 8 && options.bitDepth !== 16) {
  	    throw new Error(
  	      "option bit depth:" + options.bitDepth + " is not supported at present"
  	    );
  	  }
  	});

  	Packer.prototype.getDeflateOptions = function () {
  	  return {
  	    chunkSize: this._options.deflateChunkSize,
  	    level: this._options.deflateLevel,
  	    strategy: this._options.deflateStrategy,
  	  };
  	};

  	Packer.prototype.createDeflate = function () {
  	  return this._options.deflateFactory(this.getDeflateOptions());
  	};

  	Packer.prototype.filterData = function (data, width, height) {
  	  // convert to correct format for filtering (e.g. right bpp and bit depth)
  	  let packedData = bitPacker(data, width, height, this._options);

  	  // filter pixel data
  	  let bpp = constants.COLORTYPE_TO_BPP_MAP[this._options.colorType];
  	  let filteredData = filter(packedData, width, height, this._options, bpp);
  	  return filteredData;
  	};

  	Packer.prototype._packChunk = function (type, data) {
  	  let len = data ? data.length : 0;
  	  let buf = Buffer.alloc(len + 12);

  	  buf.writeUInt32BE(len, 0);
  	  buf.writeUInt32BE(type, 4);

  	  if (data) {
  	    data.copy(buf, 8);
  	  }

  	  buf.writeInt32BE(
  	    CrcStream.crc32(buf.slice(4, buf.length - 4)),
  	    buf.length - 4
  	  );
  	  return buf;
  	};

  	Packer.prototype.packGAMA = function (gamma) {
  	  let buf = Buffer.alloc(4);
  	  buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
  	  return this._packChunk(constants.TYPE_gAMA, buf);
  	};

  	Packer.prototype.packIHDR = function (width, height) {
  	  let buf = Buffer.alloc(13);
  	  buf.writeUInt32BE(width, 0);
  	  buf.writeUInt32BE(height, 4);
  	  buf[8] = this._options.bitDepth; // Bit depth
  	  buf[9] = this._options.colorType; // colorType
  	  buf[10] = 0; // compression
  	  buf[11] = 0; // filter
  	  buf[12] = 0; // interlace

  	  return this._packChunk(constants.TYPE_IHDR, buf);
  	};

  	Packer.prototype.packIDAT = function (data) {
  	  return this._packChunk(constants.TYPE_IDAT, data);
  	};

  	Packer.prototype.packIEND = function () {
  	  return this._packChunk(constants.TYPE_IEND, null);
  	};
  	return packer.exports;
  }

  var hasRequiredPackerAsync;

  function requirePackerAsync () {
  	if (hasRequiredPackerAsync) return packerAsync.exports;
  	hasRequiredPackerAsync = 1;

  	let util = require$$0$2;
  	let Stream = require$$1;
  	let constants = requireConstants();
  	let Packer = requirePacker();

  	let PackerAsync = (packerAsync.exports = function (opt) {
  	  Stream.call(this);

  	  let options = opt || {};

  	  this._packer = new Packer(options);
  	  this._deflate = this._packer.createDeflate();

  	  this.readable = true;
  	});
  	util.inherits(PackerAsync, Stream);

  	PackerAsync.prototype.pack = function (data, width, height, gamma) {
  	  // Signature
  	  this.emit("data", Buffer.from(constants.PNG_SIGNATURE));
  	  this.emit("data", this._packer.packIHDR(width, height));

  	  if (gamma) {
  	    this.emit("data", this._packer.packGAMA(gamma));
  	  }

  	  let filteredData = this._packer.filterData(data, width, height);

  	  // compress it
  	  this._deflate.on("error", this.emit.bind(this, "error"));

  	  this._deflate.on(
  	    "data",
  	    function (compressedData) {
  	      this.emit("data", this._packer.packIDAT(compressedData));
  	    }.bind(this)
  	  );

  	  this._deflate.on(
  	    "end",
  	    function () {
  	      this.emit("data", this._packer.packIEND());
  	      this.emit("end");
  	    }.bind(this)
  	  );

  	  this._deflate.end(filteredData);
  	};
  	return packerAsync.exports;
  }

  var pngSync = {};

  var syncInflate = {exports: {}};

  function compare(a, b) {
    if (a === b) {
      return 0;
    }

    var x = a.length;
    var y = b.length;

    for (var i = 0, len = Math.min(x, y); i < len; ++i) {
      if (a[i] !== b[i]) {
        x = a[i];
        y = b[i];
        break;
      }
    }

    if (x < y) {
      return -1;
    }
    if (y < x) {
      return 1;
    }
    return 0;
  }
  var hasOwn = Object.prototype.hasOwnProperty;

  var objectKeys = Object.keys || function (obj) {
    var keys = [];
    for (var key in obj) {
      if (hasOwn.call(obj, key)) keys.push(key);
    }
    return keys;
  };
  var pSlice = Array.prototype.slice;
  var _functionsHaveNames;
  function functionsHaveNames() {
    if (typeof _functionsHaveNames !== 'undefined') {
      return _functionsHaveNames;
    }
    return _functionsHaveNames = (function () {
      return function foo() {}.name === 'foo';
    }());
  }
  function pToString (obj) {
    return Object.prototype.toString.call(obj);
  }
  function isView(arrbuf) {
    if (isBuffer$1(arrbuf)) {
      return false;
    }
    if (typeof global$1.ArrayBuffer !== 'function') {
      return false;
    }
    if (typeof ArrayBuffer.isView === 'function') {
      return ArrayBuffer.isView(arrbuf);
    }
    if (!arrbuf) {
      return false;
    }
    if (arrbuf instanceof DataView) {
      return true;
    }
    if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
      return true;
    }
    return false;
  }
  // 1. The assert module provides functions that throw
  // AssertionError's when particular conditions are not met. The
  // assert module must conform to the following interface.

  function assert(value, message) {
    if (!value) fail(value, true, message, '==', ok);
  }

  // 2. The AssertionError is defined in assert.
  // new assert.AssertionError({ message: message,
  //                             actual: actual,
  //                             expected: expected })

  var regex = /\s*function\s+([^\(\s]*)\s*/;
  // based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
  function getName(func) {
    if (!isFunction(func)) {
      return;
    }
    if (functionsHaveNames()) {
      return func.name;
    }
    var str = func.toString();
    var match = str.match(regex);
    return match && match[1];
  }
  assert.AssertionError = AssertionError;
  function AssertionError(options) {
    this.name = 'AssertionError';
    this.actual = options.actual;
    this.expected = options.expected;
    this.operator = options.operator;
    if (options.message) {
      this.message = options.message;
      this.generatedMessage = false;
    } else {
      this.message = getMessage(this);
      this.generatedMessage = true;
    }
    var stackStartFunction = options.stackStartFunction || fail;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, stackStartFunction);
    } else {
      // non v8 browsers so we can have a stacktrace
      var err = new Error();
      if (err.stack) {
        var out = err.stack;

        // try to strip useless frames
        var fn_name = getName(stackStartFunction);
        var idx = out.indexOf('\n' + fn_name);
        if (idx >= 0) {
          // once we have located the function frame
          // we need to strip out everything before it (and its line)
          var next_line = out.indexOf('\n', idx + 1);
          out = out.substring(next_line + 1);
        }

        this.stack = out;
      }
    }
  }

  // assert.AssertionError instanceof Error
  inherits(AssertionError, Error);

  function truncate(s, n) {
    if (typeof s === 'string') {
      return s.length < n ? s : s.slice(0, n);
    } else {
      return s;
    }
  }
  function inspect(something) {
    if (functionsHaveNames() || !isFunction(something)) {
      return inspect$1(something);
    }
    var rawname = getName(something);
    var name = rawname ? ': ' + rawname : '';
    return '[Function' +  name + ']';
  }
  function getMessage(self) {
    return truncate(inspect(self.actual), 128) + ' ' +
           self.operator + ' ' +
           truncate(inspect(self.expected), 128);
  }

  // At present only the three keys mentioned above are used and
  // understood by the spec. Implementations or sub modules can pass
  // other keys to the AssertionError's constructor - they will be
  // ignored.

  // 3. All of the following functions must throw an AssertionError
  // when a corresponding condition is not met, with a message that
  // may be undefined if not provided.  All assertion methods provide
  // both the actual and expected values to the assertion error for
  // display purposes.

  function fail(actual, expected, message, operator, stackStartFunction) {
    throw new AssertionError({
      message: message,
      actual: actual,
      expected: expected,
      operator: operator,
      stackStartFunction: stackStartFunction
    });
  }

  // EXTENSION! allows for well behaved errors defined elsewhere.
  assert.fail = fail;

  // 4. Pure assertion tests whether a value is truthy, as determined
  // by !!guard.
  // assert.ok(guard, message_opt);
  // This statement is equivalent to assert.equal(true, !!guard,
  // message_opt);. To test strictly for the value true, use
  // assert.strictEqual(true, guard, message_opt);.

  function ok(value, message) {
    if (!value) fail(value, true, message, '==', ok);
  }
  assert.ok = ok;

  // 5. The equality assertion tests shallow, coercive equality with
  // ==.
  // assert.equal(actual, expected, message_opt);
  assert.equal = equal;
  function equal(actual, expected, message) {
    if (actual != expected) fail(actual, expected, message, '==', equal);
  }

  // 6. The non-equality assertion tests for whether two objects are not equal
  // with != assert.notEqual(actual, expected, message_opt);
  assert.notEqual = notEqual;
  function notEqual(actual, expected, message) {
    if (actual == expected) {
      fail(actual, expected, message, '!=', notEqual);
    }
  }

  // 7. The equivalence assertion tests a deep equality relation.
  // assert.deepEqual(actual, expected, message_opt);
  assert.deepEqual = deepEqual;
  function deepEqual(actual, expected, message) {
    if (!_deepEqual(actual, expected, false)) {
      fail(actual, expected, message, 'deepEqual', deepEqual);
    }
  }
  assert.deepStrictEqual = deepStrictEqual;
  function deepStrictEqual(actual, expected, message) {
    if (!_deepEqual(actual, expected, true)) {
      fail(actual, expected, message, 'deepStrictEqual', deepStrictEqual);
    }
  }

  function _deepEqual(actual, expected, strict, memos) {
    // 7.1. All identical values are equivalent, as determined by ===.
    if (actual === expected) {
      return true;
    } else if (isBuffer$1(actual) && isBuffer$1(expected)) {
      return compare(actual, expected) === 0;

    // 7.2. If the expected value is a Date object, the actual value is
    // equivalent if it is also a Date object that refers to the same time.
    } else if (isDate(actual) && isDate(expected)) {
      return actual.getTime() === expected.getTime();

    // 7.3 If the expected value is a RegExp object, the actual value is
    // equivalent if it is also a RegExp object with the same source and
    // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
    } else if (isRegExp(actual) && isRegExp(expected)) {
      return actual.source === expected.source &&
             actual.global === expected.global &&
             actual.multiline === expected.multiline &&
             actual.lastIndex === expected.lastIndex &&
             actual.ignoreCase === expected.ignoreCase;

    // 7.4. Other pairs that do not both pass typeof value == 'object',
    // equivalence is determined by ==.
    } else if ((actual === null || typeof actual !== 'object') &&
               (expected === null || typeof expected !== 'object')) {
      return strict ? actual === expected : actual == expected;

    // If both values are instances of typed arrays, wrap their underlying
    // ArrayBuffers in a Buffer each to increase performance
    // This optimization requires the arrays to have the same type as checked by
    // Object.prototype.toString (aka pToString). Never perform binary
    // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
    // bit patterns are not identical.
    } else if (isView(actual) && isView(expected) &&
               pToString(actual) === pToString(expected) &&
               !(actual instanceof Float32Array ||
                 actual instanceof Float64Array)) {
      return compare(new Uint8Array(actual.buffer),
                     new Uint8Array(expected.buffer)) === 0;

    // 7.5 For all other Object pairs, including Array objects, equivalence is
    // determined by having the same number of owned properties (as verified
    // with Object.prototype.hasOwnProperty.call), the same set of keys
    // (although not necessarily the same order), equivalent values for every
    // corresponding key, and an identical 'prototype' property. Note: this
    // accounts for both named and indexed properties on Arrays.
    } else if (isBuffer$1(actual) !== isBuffer$1(expected)) {
      return false;
    } else {
      memos = memos || {actual: [], expected: []};

      var actualIndex = memos.actual.indexOf(actual);
      if (actualIndex !== -1) {
        if (actualIndex === memos.expected.indexOf(expected)) {
          return true;
        }
      }

      memos.actual.push(actual);
      memos.expected.push(expected);

      return objEquiv(actual, expected, strict, memos);
    }
  }

  function isArguments(object) {
    return Object.prototype.toString.call(object) == '[object Arguments]';
  }

  function objEquiv(a, b, strict, actualVisitedObjects) {
    if (a === null || a === undefined || b === null || b === undefined)
      return false;
    // if one is a primitive, the other must be same
    if (isPrimitive(a) || isPrimitive(b))
      return a === b;
    if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
      return false;
    var aIsArgs = isArguments(a);
    var bIsArgs = isArguments(b);
    if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
      return false;
    if (aIsArgs) {
      a = pSlice.call(a);
      b = pSlice.call(b);
      return _deepEqual(a, b, strict);
    }
    var ka = objectKeys(a);
    var kb = objectKeys(b);
    var key, i;
    // having the same number of owned properties (keys incorporates
    // hasOwnProperty)
    if (ka.length !== kb.length)
      return false;
    //the same set of keys (although not necessarily the same order),
    ka.sort();
    kb.sort();
    //~~~cheap key test
    for (i = ka.length - 1; i >= 0; i--) {
      if (ka[i] !== kb[i])
        return false;
    }
    //equivalent values for every corresponding key, and
    //~~~possibly expensive deep test
    for (i = ka.length - 1; i >= 0; i--) {
      key = ka[i];
      if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
        return false;
    }
    return true;
  }

  // 8. The non-equivalence assertion tests for any deep inequality.
  // assert.notDeepEqual(actual, expected, message_opt);
  assert.notDeepEqual = notDeepEqual;
  function notDeepEqual(actual, expected, message) {
    if (_deepEqual(actual, expected, false)) {
      fail(actual, expected, message, 'notDeepEqual', notDeepEqual);
    }
  }

  assert.notDeepStrictEqual = notDeepStrictEqual;
  function notDeepStrictEqual(actual, expected, message) {
    if (_deepEqual(actual, expected, true)) {
      fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
    }
  }


  // 9. The strict equality assertion tests strict equality, as determined by ===.
  // assert.strictEqual(actual, expected, message_opt);
  assert.strictEqual = strictEqual;
  function strictEqual(actual, expected, message) {
    if (actual !== expected) {
      fail(actual, expected, message, '===', strictEqual);
    }
  }

  // 10. The strict non-equality assertion tests for strict inequality, as
  // determined by !==.  assert.notStrictEqual(actual, expected, message_opt);
  assert.notStrictEqual = notStrictEqual;
  function notStrictEqual(actual, expected, message) {
    if (actual === expected) {
      fail(actual, expected, message, '!==', notStrictEqual);
    }
  }

  function expectedException(actual, expected) {
    if (!actual || !expected) {
      return false;
    }

    if (Object.prototype.toString.call(expected) == '[object RegExp]') {
      return expected.test(actual);
    }

    try {
      if (actual instanceof expected) {
        return true;
      }
    } catch (e) {
      // Ignore.  The instanceof check doesn't work for arrow functions.
    }

    if (Error.isPrototypeOf(expected)) {
      return false;
    }

    return expected.call({}, actual) === true;
  }

  function _tryBlock(block) {
    var error;
    try {
      block();
    } catch (e) {
      error = e;
    }
    return error;
  }

  function _throws(shouldThrow, block, expected, message) {
    var actual;

    if (typeof block !== 'function') {
      throw new TypeError('"block" argument must be a function');
    }

    if (typeof expected === 'string') {
      message = expected;
      expected = null;
    }

    actual = _tryBlock(block);

    message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
              (message ? ' ' + message : '.');

    if (shouldThrow && !actual) {
      fail(actual, expected, 'Missing expected exception' + message);
    }

    var userProvidedMessage = typeof message === 'string';
    var isUnwantedException = !shouldThrow && isError(actual);
    var isUnexpectedException = !shouldThrow && actual && !expected;

    if ((isUnwantedException &&
        userProvidedMessage &&
        expectedException(actual, expected)) ||
        isUnexpectedException) {
      fail(actual, expected, 'Got unwanted exception' + message);
    }

    if ((shouldThrow && actual && expected &&
        !expectedException(actual, expected)) || (!shouldThrow && actual)) {
      throw actual;
    }
  }

  // 11. Expected to throw an error:
  // assert.throws(block, Error_opt, message_opt);
  assert.throws = throws;
  function throws(block, /*optional*/error, /*optional*/message) {
    _throws(true, block, error, message);
  }

  // EXTENSION! This is annoying to write outside this module.
  assert.doesNotThrow = doesNotThrow;
  function doesNotThrow(block, /*optional*/error, /*optional*/message) {
    _throws(false, block, error, message);
  }

  assert.ifError = ifError;
  function ifError(err) {
    if (err) throw err;
  }

  var _polyfillNode_assert = /*#__PURE__*/Object.freeze({
    __proto__: null,
    AssertionError: AssertionError,
    assert: ok,
    deepEqual: deepEqual,
    deepStrictEqual: deepStrictEqual,
    default: assert,
    doesNotThrow: doesNotThrow,
    equal: equal,
    fail: fail,
    ifError: ifError,
    notDeepEqual: notDeepEqual,
    notDeepStrictEqual: notDeepStrictEqual,
    notEqual: notEqual,
    notStrictEqual: notStrictEqual,
    ok: ok,
    strictEqual: strictEqual,
    throws: throws
  });

  var require$$0 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_assert);

  var require$$3 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_buffer);

  var hasRequiredSyncInflate;

  function requireSyncInflate () {
  	if (hasRequiredSyncInflate) return syncInflate.exports;
  	hasRequiredSyncInflate = 1;
  	(function (module, exports) {

  		let assert = require$$0.ok;
  		let zlib = require$$0$1;
  		let util = require$$0$2;

  		let kMaxLength = require$$3.kMaxLength;

  		function Inflate(opts) {
  		  if (!(this instanceof Inflate)) {
  		    return new Inflate(opts);
  		  }

  		  if (opts && opts.chunkSize < zlib.Z_MIN_CHUNK) {
  		    opts.chunkSize = zlib.Z_MIN_CHUNK;
  		  }

  		  zlib.Inflate.call(this, opts);

  		  // Node 8 --> 9 compatibility check
  		  this._offset = this._offset === undefined ? this._outOffset : this._offset;
  		  this._buffer = this._buffer || this._outBuffer;

  		  if (opts && opts.maxLength != null) {
  		    this._maxLength = opts.maxLength;
  		  }
  		}

  		function createInflate(opts) {
  		  return new Inflate(opts);
  		}

  		function _close(engine, callback) {

  		  // Caller may invoke .close after a zlib error (which will null _handle).
  		  if (!engine._handle) {
  		    return;
  		  }

  		  engine._handle.close();
  		  engine._handle = null;
  		}

  		Inflate.prototype._processChunk = function (chunk, flushFlag, asyncCb) {
  		  if (typeof asyncCb === "function") {
  		    return zlib.Inflate._processChunk.call(this, chunk, flushFlag, asyncCb);
  		  }

  		  let self = this;

  		  let availInBefore = chunk && chunk.length;
  		  let availOutBefore = this._chunkSize - this._offset;
  		  let leftToInflate = this._maxLength;
  		  let inOff = 0;

  		  let buffers = [];
  		  let nread = 0;

  		  let error;
  		  this.on("error", function (err) {
  		    error = err;
  		  });

  		  function handleChunk(availInAfter, availOutAfter) {
  		    if (self._hadError) {
  		      return;
  		    }

  		    let have = availOutBefore - availOutAfter;
  		    assert(have >= 0, "have should not go down");

  		    if (have > 0) {
  		      let out = self._buffer.slice(self._offset, self._offset + have);
  		      self._offset += have;

  		      if (out.length > leftToInflate) {
  		        out = out.slice(0, leftToInflate);
  		      }

  		      buffers.push(out);
  		      nread += out.length;
  		      leftToInflate -= out.length;

  		      if (leftToInflate === 0) {
  		        return false;
  		      }
  		    }

  		    if (availOutAfter === 0 || self._offset >= self._chunkSize) {
  		      availOutBefore = self._chunkSize;
  		      self._offset = 0;
  		      self._buffer = Buffer.allocUnsafe(self._chunkSize);
  		    }

  		    if (availOutAfter === 0) {
  		      inOff += availInBefore - availInAfter;
  		      availInBefore = availInAfter;

  		      return true;
  		    }

  		    return false;
  		  }

  		  assert(this._handle, "zlib binding closed");
  		  let res;
  		  do {
  		    res = this._handle.writeSync(
  		      flushFlag,
  		      chunk, // in
  		      inOff, // in_off
  		      availInBefore, // in_len
  		      this._buffer, // out
  		      this._offset, //out_off
  		      availOutBefore
  		    ); // out_len
  		    // Node 8 --> 9 compatibility check
  		    res = res || this._writeState;
  		  } while (!this._hadError && handleChunk(res[0], res[1]));

  		  if (this._hadError) {
  		    throw error;
  		  }

  		  if (nread >= kMaxLength) {
  		    _close(this);
  		    throw new RangeError(
  		      "Cannot create final Buffer. It would be larger than 0x" +
  		        kMaxLength.toString(16) +
  		        " bytes"
  		    );
  		  }

  		  let buf = Buffer.concat(buffers, nread);
  		  _close(this);

  		  return buf;
  		};

  		util.inherits(Inflate, zlib.Inflate);

  		function zlibBufferSync(engine, buffer) {
  		  if (typeof buffer === "string") {
  		    buffer = Buffer.from(buffer);
  		  }
  		  if (!(buffer instanceof Buffer)) {
  		    throw new TypeError("Not a string or buffer");
  		  }

  		  let flushFlag = engine._finishFlushFlag;
  		  if (flushFlag == null) {
  		    flushFlag = zlib.Z_FINISH;
  		  }

  		  return engine._processChunk(buffer, flushFlag);
  		}

  		function inflateSync(buffer, opts) {
  		  return zlibBufferSync(new Inflate(opts), buffer);
  		}

  		module.exports = exports = inflateSync;
  		exports.Inflate = Inflate;
  		exports.createInflate = createInflate;
  		exports.inflateSync = inflateSync; 
  	} (syncInflate, syncInflate.exports));
  	return syncInflate.exports;
  }

  var syncReader = {exports: {}};

  var hasRequiredSyncReader;

  function requireSyncReader () {
  	if (hasRequiredSyncReader) return syncReader.exports;
  	hasRequiredSyncReader = 1;

  	let SyncReader = (syncReader.exports = function (buffer) {
  	  this._buffer = buffer;
  	  this._reads = [];
  	});

  	SyncReader.prototype.read = function (length, callback) {
  	  this._reads.push({
  	    length: Math.abs(length), // if length < 0 then at most this length
  	    allowLess: length < 0,
  	    func: callback,
  	  });
  	};

  	SyncReader.prototype.process = function () {
  	  // as long as there is any data and read requests
  	  while (this._reads.length > 0 && this._buffer.length) {
  	    let read = this._reads[0];

  	    if (
  	      this._buffer.length &&
  	      (this._buffer.length >= read.length || read.allowLess)
  	    ) {
  	      // ok there is any data so that we can satisfy this request
  	      this._reads.shift(); // == read

  	      let buf = this._buffer;

  	      this._buffer = buf.slice(read.length);

  	      read.func.call(this, buf.slice(0, read.length));
  	    } else {
  	      break;
  	    }
  	  }

  	  if (this._reads.length > 0) {
  	    throw new Error("There are some read requests waitng on finished stream");
  	  }

  	  if (this._buffer.length > 0) {
  	    throw new Error("unrecognised content at end of stream");
  	  }
  	};
  	return syncReader.exports;
  }

  var filterParseSync = {};

  var hasRequiredFilterParseSync;

  function requireFilterParseSync () {
  	if (hasRequiredFilterParseSync) return filterParseSync;
  	hasRequiredFilterParseSync = 1;

  	let SyncReader = requireSyncReader();
  	let Filter = requireFilterParse();

  	filterParseSync.process = function (inBuffer, bitmapInfo) {
  	  let outBuffers = [];
  	  let reader = new SyncReader(inBuffer);
  	  let filter = new Filter(bitmapInfo, {
  	    read: reader.read.bind(reader),
  	    write: function (bufferPart) {
  	      outBuffers.push(bufferPart);
  	    },
  	    complete: function () {},
  	  });

  	  filter.start();
  	  reader.process();

  	  return Buffer.concat(outBuffers);
  	};
  	return filterParseSync;
  }

  var parserSync;
  var hasRequiredParserSync;

  function requireParserSync () {
  	if (hasRequiredParserSync) return parserSync;
  	hasRequiredParserSync = 1;

  	let hasSyncZlib = true;
  	let zlib = require$$0$1;
  	let inflateSync = requireSyncInflate();
  	if (!zlib.deflateSync) {
  	  hasSyncZlib = false;
  	}
  	let SyncReader = requireSyncReader();
  	let FilterSync = requireFilterParseSync();
  	let Parser = requireParser();
  	let bitmapper = requireBitmapper();
  	let formatNormaliser = requireFormatNormaliser();

  	parserSync = function (buffer, options) {
  	  if (!hasSyncZlib) {
  	    throw new Error(
  	      "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
  	    );
  	  }

  	  let err;
  	  function handleError(_err_) {
  	    err = _err_;
  	  }

  	  let metaData;
  	  function handleMetaData(_metaData_) {
  	    metaData = _metaData_;
  	  }

  	  function handleTransColor(transColor) {
  	    metaData.transColor = transColor;
  	  }

  	  function handlePalette(palette) {
  	    metaData.palette = palette;
  	  }

  	  function handleSimpleTransparency() {
  	    metaData.alpha = true;
  	  }

  	  let gamma;
  	  function handleGamma(_gamma_) {
  	    gamma = _gamma_;
  	  }

  	  let inflateDataList = [];
  	  function handleInflateData(inflatedData) {
  	    inflateDataList.push(inflatedData);
  	  }

  	  let reader = new SyncReader(buffer);

  	  let parser = new Parser(options, {
  	    read: reader.read.bind(reader),
  	    error: handleError,
  	    metadata: handleMetaData,
  	    gamma: handleGamma,
  	    palette: handlePalette,
  	    transColor: handleTransColor,
  	    inflateData: handleInflateData,
  	    simpleTransparency: handleSimpleTransparency,
  	  });

  	  parser.start();
  	  reader.process();

  	  if (err) {
  	    throw err;
  	  }

  	  //join together the inflate datas
  	  let inflateData = Buffer.concat(inflateDataList);
  	  inflateDataList.length = 0;

  	  let inflatedData;
  	  if (metaData.interlace) {
  	    inflatedData = zlib.inflateSync(inflateData);
  	  } else {
  	    let rowSize =
  	      ((metaData.width * metaData.bpp * metaData.depth + 7) >> 3) + 1;
  	    let imageSize = rowSize * metaData.height;
  	    inflatedData = inflateSync(inflateData, {
  	      chunkSize: imageSize,
  	      maxLength: imageSize,
  	    });
  	  }
  	  inflateData = null;

  	  if (!inflatedData || !inflatedData.length) {
  	    throw new Error("bad png - invalid inflate data response");
  	  }

  	  let unfilteredData = FilterSync.process(inflatedData, metaData);
  	  inflateData = null;

  	  let bitmapData = bitmapper.dataToBitMap(unfilteredData, metaData);
  	  unfilteredData = null;

  	  let normalisedBitmapData = formatNormaliser(
  	    bitmapData,
  	    metaData,
  	    options.skipRescale
  	  );

  	  metaData.data = normalisedBitmapData;
  	  metaData.gamma = gamma || 0;

  	  return metaData;
  	};
  	return parserSync;
  }

  var packerSync;
  var hasRequiredPackerSync;

  function requirePackerSync () {
  	if (hasRequiredPackerSync) return packerSync;
  	hasRequiredPackerSync = 1;

  	let hasSyncZlib = true;
  	let zlib = require$$0$1;
  	if (!zlib.deflateSync) {
  	  hasSyncZlib = false;
  	}
  	let constants = requireConstants();
  	let Packer = requirePacker();

  	packerSync = function (metaData, opt) {
  	  if (!hasSyncZlib) {
  	    throw new Error(
  	      "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
  	    );
  	  }

  	  let options = opt || {};

  	  let packer = new Packer(options);

  	  let chunks = [];

  	  // Signature
  	  chunks.push(Buffer.from(constants.PNG_SIGNATURE));

  	  // Header
  	  chunks.push(packer.packIHDR(metaData.width, metaData.height));

  	  if (metaData.gamma) {
  	    chunks.push(packer.packGAMA(metaData.gamma));
  	  }

  	  let filteredData = packer.filterData(
  	    metaData.data,
  	    metaData.width,
  	    metaData.height
  	  );

  	  // compress it
  	  let compressedData = zlib.deflateSync(
  	    filteredData,
  	    packer.getDeflateOptions()
  	  );
  	  filteredData = null;

  	  if (!compressedData || !compressedData.length) {
  	    throw new Error("bad png - invalid compressed data response");
  	  }
  	  chunks.push(packer.packIDAT(compressedData));

  	  // End
  	  chunks.push(packer.packIEND());

  	  return Buffer.concat(chunks);
  	};
  	return packerSync;
  }

  var hasRequiredPngSync;

  function requirePngSync () {
  	if (hasRequiredPngSync) return pngSync;
  	hasRequiredPngSync = 1;

  	let parse = requireParserSync();
  	let pack = requirePackerSync();

  	pngSync.read = function (buffer, options) {
  	  return parse(buffer, options || {});
  	};

  	pngSync.write = function (png, options) {
  	  return pack(png, options);
  	};
  	return pngSync;
  }

  var hasRequiredPng;

  function requirePng () {
  	if (hasRequiredPng) return png;
  	hasRequiredPng = 1;

  	let util = require$$0$2;
  	let Stream = require$$1;
  	let Parser = requireParserAsync();
  	let Packer = requirePackerAsync();
  	let PNGSync = requirePngSync();

  	let PNG = (png.PNG = function (options) {
  	  Stream.call(this);

  	  options = options || {}; // eslint-disable-line no-param-reassign

  	  // coerce pixel dimensions to integers (also coerces undefined -> 0):
  	  this.width = options.width | 0;
  	  this.height = options.height | 0;

  	  this.data =
  	    this.width > 0 && this.height > 0
  	      ? Buffer.alloc(4 * this.width * this.height)
  	      : null;

  	  if (options.fill && this.data) {
  	    this.data.fill(0);
  	  }

  	  this.gamma = 0;
  	  this.readable = this.writable = true;

  	  this._parser = new Parser(options);

  	  this._parser.on("error", this.emit.bind(this, "error"));
  	  this._parser.on("close", this._handleClose.bind(this));
  	  this._parser.on("metadata", this._metadata.bind(this));
  	  this._parser.on("gamma", this._gamma.bind(this));
  	  this._parser.on(
  	    "parsed",
  	    function (data) {
  	      this.data = data;
  	      this.emit("parsed", data);
  	    }.bind(this)
  	  );

  	  this._packer = new Packer(options);
  	  this._packer.on("data", this.emit.bind(this, "data"));
  	  this._packer.on("end", this.emit.bind(this, "end"));
  	  this._parser.on("close", this._handleClose.bind(this));
  	  this._packer.on("error", this.emit.bind(this, "error"));
  	});
  	util.inherits(PNG, Stream);

  	PNG.sync = PNGSync;

  	PNG.prototype.pack = function () {
  	  if (!this.data || !this.data.length) {
  	    this.emit("error", "No data provided");
  	    return this;
  	  }

  	  browser$1$1.nextTick(
  	    function () {
  	      this._packer.pack(this.data, this.width, this.height, this.gamma);
  	    }.bind(this)
  	  );

  	  return this;
  	};

  	PNG.prototype.parse = function (data, callback) {
  	  if (callback) {
  	    let onParsed, onError;

  	    onParsed = function (parsedData) {
  	      this.removeListener("error", onError);

  	      this.data = parsedData;
  	      callback(null, this);
  	    }.bind(this);

  	    onError = function (err) {
  	      this.removeListener("parsed", onParsed);

  	      callback(err, null);
  	    }.bind(this);

  	    this.once("parsed", onParsed);
  	    this.once("error", onError);
  	  }

  	  this.end(data);
  	  return this;
  	};

  	PNG.prototype.write = function (data) {
  	  this._parser.write(data);
  	  return true;
  	};

  	PNG.prototype.end = function (data) {
  	  this._parser.end(data);
  	};

  	PNG.prototype._metadata = function (metadata) {
  	  this.width = metadata.width;
  	  this.height = metadata.height;

  	  this.emit("metadata", metadata);
  	};

  	PNG.prototype._gamma = function (gamma) {
  	  this.gamma = gamma;
  	};

  	PNG.prototype._handleClose = function () {
  	  if (!this._parser.writable && !this._packer.readable) {
  	    this.emit("close");
  	  }
  	};

  	PNG.bitblt = function (src, dst, srcX, srcY, width, height, deltaX, deltaY) {
  	  // eslint-disable-line max-params
  	  // coerce pixel dimensions to integers (also coerces undefined -> 0):
  	  /* eslint-disable no-param-reassign */
  	  srcX |= 0;
  	  srcY |= 0;
  	  width |= 0;
  	  height |= 0;
  	  deltaX |= 0;
  	  deltaY |= 0;
  	  /* eslint-enable no-param-reassign */

  	  if (
  	    srcX > src.width ||
  	    srcY > src.height ||
  	    srcX + width > src.width ||
  	    srcY + height > src.height
  	  ) {
  	    throw new Error("bitblt reading outside image");
  	  }

  	  if (
  	    deltaX > dst.width ||
  	    deltaY > dst.height ||
  	    deltaX + width > dst.width ||
  	    deltaY + height > dst.height
  	  ) {
  	    throw new Error("bitblt writing outside image");
  	  }

  	  for (let y = 0; y < height; y++) {
  	    src.data.copy(
  	      dst.data,
  	      ((deltaY + y) * dst.width + deltaX) << 2,
  	      ((srcY + y) * src.width + srcX) << 2,
  	      ((srcY + y) * src.width + srcX + width) << 2
  	    );
  	  }
  	};

  	PNG.prototype.bitblt = function (
  	  dst,
  	  srcX,
  	  srcY,
  	  width,
  	  height,
  	  deltaX,
  	  deltaY
  	) {
  	  // eslint-disable-line max-params

  	  PNG.bitblt(this, dst, srcX, srcY, width, height, deltaX, deltaY);
  	  return this;
  	};

  	PNG.adjustGamma = function (src) {
  	  if (src.gamma) {
  	    for (let y = 0; y < src.height; y++) {
  	      for (let x = 0; x < src.width; x++) {
  	        let idx = (src.width * y + x) << 2;

  	        for (let i = 0; i < 3; i++) {
  	          let sample = src.data[idx + i] / 255;
  	          sample = Math.pow(sample, 1 / 2.2 / src.gamma);
  	          src.data[idx + i] = Math.round(sample * 255);
  	        }
  	      }
  	    }
  	    src.gamma = 0;
  	  }
  	};

  	PNG.prototype.adjustGamma = function () {
  	  PNG.adjustGamma(this);
  	};
  	return png;
  }

  var pngExports = requirePng();

  function encodeString(string, output, offset) {
    for (const char of new TextEncoder().encode(string)) {
      output.setUint8(offset, char);
      offset++;
    }
    output.setUint8(offset, 0);
    offset++;
    return offset;
  }
  function decodeString(input, offset) {
    const bytes = [];
    while (true) {
      const byte = input.getUint8(offset);
      offset++;
      if (byte === 0) {
        break;
      }
      bytes.push(byte);
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  }
  function stringEncodedLength(string) {
    return new TextEncoder().encode(string).length + 1;
  }

  var __defProp$2 = Object.defineProperty;
  var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField$2 = (obj, key, value) => __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
  class EmbedRequest {
    constructor(arrayBuffer, requestedOffset) {
      this.arrayBuffer = arrayBuffer;
      this.requestedOffset = requestedOffset;
    }
    length() {
      return this.arrayBuffer.byteLength;
    }
    /**
     * Writes the data in {@link arrayBuffer} to `output`.
     * It will revisit a previous location in `output` specified by {@link requestedOffset}
     * to write down the offset and length information there.
     * 
     * @param output The output buffer to write to.
     * @param offset The offset in the output buffer to start writing at.
     */
    write(output, offset) {
      output.setBigUint64(this.requestedOffset, BigInt(offset), true);
      output.setBigUint64(this.requestedOffset + 8, BigInt(this.length()), true);
      const input = new DataView(this.arrayBuffer);
      for (let i = 0; i < this.length(); i++) {
        output.setUint8(offset, input.getUint8(i));
        offset++;
      }
      return offset;
    }
  }
  class Provider {
    /**
     * If {@link EmbedRequest} objects are created when {@link encode} is called,
     * the length returned by this method should include the lengths of those embedded files
     * in addition to the length returned by {@link encodedLength}.
     * 
     * @returns The total length of the encoded data.
     * 
     * @see {@link FileProvider.encodedLength}
     */
    totalEncodedLength() {
      return this.encodedLength();
    }
  }
  const _AudioProvider = class _AudioProvider extends Provider {
    /**
     * Uses [@wasm-audio-decoders/ogg-vorbis](https://www.npmjs.com/package/@wasm-audio-decoders/ogg-vorbis)
     * to decode audio data in Ogg Vorbis format.
     * 
     * See {@link audioBuffer} for how the parameter `context` is used.
     * 
     * @param arrayBuffer The array buffer containing the audio data in Ogg Vorbis format.
     * @param context The audio context to use for creating the audio buffer.
     * @returns The decoded audio buffer.
     */
    static async decodeAudio(arrayBuffer, context) {
      if (!_AudioProvider.decoder) {
        _AudioProvider.decoder = new OggVorbisDecoder();
        await _AudioProvider.decoder.ready;
      } else {
        await _AudioProvider.decoder.reset();
      }
      const decoder = _AudioProvider.decoder;
      const { channelData, sampleRate } = await decoder.decodeFile(new Uint8Array(arrayBuffer));
      const numberOfChannels = channelData.length;
      const length = channelData[0].length;
      const result = context?.createBuffer(numberOfChannels, length, sampleRate) ?? new AudioBuffer({ numberOfChannels, length, sampleRate });
      for (let i = 0; i < numberOfChannels; i++) {
        result.copyToChannel(channelData[i], i);
      }
      return result;
    }
  };
  __publicField$2(_AudioProvider, "decoder");
  let AudioProvider = _AudioProvider;
  class MusicProvider extends AudioProvider {
    static decode(music, input, offset) {
      return new MusicFromFileProvider(FileProvider.decode(input, offset));
    }
  }
  class PreviewProvider extends AudioProvider {
    static decode(music, input, offset) {
      switch (input.getInt8(offset)) {
        case 0:
          return PreviewFromMusicProvider.decode(music, input, offset);
        default:
          return new PreviewFromFileProvider(FileProvider.decode(input, offset));
      }
    }
  }
  class CoverProvider extends Provider {
    static decode(music, input, offset) {
      switch (input.getInt8(offset)) {
        case 0:
          return new CoverEmptyProvider();
        default:
          return new CoverFromFileProvider(FileProvider.decode(input, offset));
      }
    }
  }
  class ChartProvider extends Provider {
    static decode(music, input, offset) {
      return new ChartFromFileEmbedded(FileEmbedded.decode(input, offset));
    }
  }
  class FileProvider {
    constructor() {
      __publicField$2(this, "compressed", false);
    }
    async arrayBuffer() {
      if (!this.compressed) {
        return await this.originalArrayBuffer();
      }
      return await new Response(
        new Blob([await this.originalArrayBuffer()]).stream().pipeThrough(new DecompressionStream("gzip"))
      ).arrayBuffer();
    }
    /**
     * In addition to {@link encodedLength}, this includes the length of data that will be written later
     * by {@link EmbedRequest.write}.
     */
    totalEncodedLength() {
      return this.encodedLength();
    }
    static decode(input, offset) {
      const type = input.getInt8(offset);
      switch (type) {
        case 1:
        case -1:
          return FileEmbedded.decode(input, offset);
        case 2:
        case -2:
          return FileFromUrl.decode(input, offset);
        case 3:
        case -3:
          return FileFromPath.decode(input, offset);
      }
    }
  }
  class MusicFromFileProvider extends MusicProvider {
    constructor(fileProvider) {
      super();
      this.fileProvider = fileProvider;
    }
    encodedLength() {
      return this.fileProvider.encodedLength();
    }
    totalEncodedLength() {
      return this.fileProvider.totalEncodedLength();
    }
    async audioBuffer(context) {
      return await AudioProvider.decodeAudio(await this.fileProvider.arrayBuffer(), context);
    }
    encode(output, offset) {
      return this.fileProvider.encode(output, offset);
    }
  }
  class PreviewFromFileProvider extends PreviewProvider {
    constructor(fileProvider) {
      super();
      this.fileProvider = fileProvider;
    }
    encodedLength() {
      return this.fileProvider.encodedLength();
    }
    totalEncodedLength() {
      return this.fileProvider.totalEncodedLength();
    }
    async audioBuffer(context) {
      return await AudioProvider.decodeAudio(await this.fileProvider.arrayBuffer(), context);
    }
    encode(output, offset) {
      return this.fileProvider.encode(output, offset);
    }
  }
  class PreviewFromMusicProvider extends PreviewProvider {
    constructor(musicProvider) {
      super();
      this.musicProvider = musicProvider;
      /**
       * The offset in the original music data to start copying from.
       * Measured in audio frames.
       */
      __publicField$2(this, "offset", 0);
      /**
       * The length of the preview.
       * Measured in audio frames.
       */
      __publicField$2(this, "length", 441e3);
      /**
       * The length of the linear fade-in effect. Set to zero to disable fade-in.
       * Measured in audio frames.
       */
      __publicField$2(this, "fadeInLength", 44100);
      /**
       * The length of the linear fade-out effect. Set to zero to disable fade-out.
       * Measured in audio frames.
       */
      __publicField$2(this, "fadeOutLength", 44100);
    }
    async audioBuffer(context) {
      const musicAudioBuffer = await this.musicProvider.audioBuffer(context);
      const { numberOfChannels, sampleRate } = musicAudioBuffer;
      const result = context?.createBuffer(numberOfChannels, this.length, sampleRate) ?? new AudioBuffer({ numberOfChannels, length: this.length, sampleRate });
      for (let i = 0; i < numberOfChannels; i++) {
        const source = musicAudioBuffer.getChannelData(i);
        const destination = result.getChannelData(i);
        for (let j = 0; j < this.length; j++) {
          const factor = Math.min((j + 1) / this.fadeInLength, (this.length - j) / this.fadeOutLength, 1);
          destination[j] = factor * source[j + this.offset];
        }
      }
      return result;
    }
    encodedLength() {
      return 25;
    }
    encode(output, offset) {
      output.setInt8(offset, 0);
      offset++;
      output.setBigUint64(offset, BigInt(this.offset), true);
      offset += 8;
      output.setBigUint64(offset, BigInt(this.length), true);
      offset += 8;
      output.setUint32(offset, this.fadeInLength, true);
      offset += 4;
      output.setUint32(offset, this.fadeOutLength, true);
      offset += 4;
      return [offset, []];
    }
    static decode(music, input, offset) {
      offset++;
      const result = new PreviewFromMusicProvider(music.musicProvider);
      result.offset = Number(input.getBigUint64(offset, true));
      offset += 8;
      result.length = Number(input.getBigUint64(offset, true));
      offset += 8;
      result.fadeInLength = input.getUint32(offset, true);
      offset += 4;
      result.fadeOutLength = input.getUint32(offset, true);
      offset += 4;
      return result;
    }
  }
  class CoverEmptyProvider extends CoverProvider {
    async imageData(context) {
      return context?.createImageData(1, 1) ?? new ImageData(1, 1);
    }
    encodedLength() {
      return 1;
    }
    encode(output, offset) {
      output.setInt8(offset, 0);
      offset++;
      return [offset, []];
    }
  }
  class CoverFromFileProvider extends CoverProvider {
    constructor(fileProvider) {
      super();
      this.fileProvider = fileProvider;
    }
    async imageData(context) {
      const buffer = await this.fileProvider.arrayBuffer();
      const png = await new Promise((resolve, reject) => new pngExports.PNG().parse(
        Buffer.from(buffer),
        // Buffer will be polyfilled; see rollup.config.js
        (error, data) => error ? reject(error) : resolve(data)
      ));
      const result = context?.createImageData(png.width, png.height) ?? new ImageData(png.width, png.height);
      result.data.set(png.data);
      return result;
    }
    encodedLength() {
      return this.fileProvider.encodedLength();
    }
    totalEncodedLength() {
      return this.fileProvider.totalEncodedLength();
    }
    encode(output, offset) {
      return this.fileProvider.encode(output, offset);
    }
  }
  class ChartFromFileEmbedded extends ChartProvider {
    constructor(fileEmbedded) {
      super();
      this.fileEmbedded = fileEmbedded;
    }
    async chart() {
      const buffer = await this.fileEmbedded.arrayBuffer();
      return Chart.decode(new DataView(buffer), 0);
    }
    encodedLength() {
      return this.fileEmbedded.encodedLength();
    }
    totalEncodedLength() {
      return this.fileEmbedded.totalEncodedLength();
    }
    encode(output, offset) {
      return this.fileEmbedded.encode(output, offset);
    }
  }
  class FileEmbedded extends FileProvider {
    /**
     * Creates an instance.
     * This will make {@link internalArrayBuffer} a copy of part of `original`.
     * If `original` is a `SharedArrayBuffer`, it will be converted to an `ArrayBuffer`.
     * 
     * @param original The original buffer to copy from.
     * @param offset The offset in the original buffer to start copying from.
     * @param length The length of the data to copy.
     */
    constructor(original = new ArrayBuffer(0), offset = 0, length = original.byteLength) {
      super();
      __publicField$2(this, "internalArrayBuffer");
      const source = new Uint8Array(original, offset, length);
      const destination = new Uint8Array(length);
      destination.set(source);
      this.internalArrayBuffer = destination.buffer;
    }
    async originalArrayBuffer() {
      return this.internalArrayBuffer;
    }
    /**
     * This changes {@link internalArrayBuffer}.
     * No matter what the value of {@link compressed} is, `arrayBuffer` needs to be uncompressed data.
     * This method does the compression if necessary before setting {@link internalArrayBuffer}.
     * 
     * @param arrayBuffer The new data to set.
     */
    async set(arrayBuffer) {
      if (!this.compressed) {
        this.internalArrayBuffer = arrayBuffer;
        return;
      }
      this.internalArrayBuffer = await new Response(
        new Blob([arrayBuffer]).stream().pipeThrough(new CompressionStream("gzip"))
      ).arrayBuffer();
    }
    encodedLength() {
      return 17;
    }
    totalEncodedLength() {
      return this.encodedLength() + this.internalArrayBuffer.byteLength;
    }
    encode(output, offset) {
      output.setInt8(offset, this.compressed ? -1 : 1);
      offset++;
      const embedRequest = new EmbedRequest(this.internalArrayBuffer, offset);
      offset += 16;
      return [offset, [embedRequest]];
    }
    static decode(input, offset) {
      const compressed = input.getInt8(offset) < 0;
      offset++;
      const embedOffset = Number(input.getBigUint64(offset, true));
      offset += 8;
      const embedLength = Number(input.getBigUint64(offset, true));
      offset += 8;
      const result = new FileEmbedded(input.buffer, embedOffset + input.byteOffset, embedLength);
      result.compressed = compressed;
      return result;
    }
  }
  class FileFromUrl extends FileProvider {
    constructor(url) {
      super();
      this.url = url;
    }
    async originalArrayBuffer() {
      const response = await fetch(this.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch music file: ${response.statusText}`);
      }
      return await response.arrayBuffer();
    }
    encodedLength() {
      return 1 + stringEncodedLength(this.url);
    }
    encode(output, offset) {
      output.setInt8(offset, this.compressed ? -2 : 2);
      offset++;
      offset = encodeString(this.url, output, offset);
      return [offset, []];
    }
    static decode(input, offset) {
      const compressed = input.getInt8(offset) < 0;
      offset++;
      const result = new FileFromUrl(decodeString(input, offset));
      result.compressed = compressed;
      return result;
    }
  }
  const _FileFromPath = class _FileFromPath extends FileProvider {
    constructor(path) {
      super();
      this.path = path;
    }
    async originalArrayBuffer() {
      const base = _FileFromPath.base;
      if (_FileFromPath.base === void 0) {
        throw new Error("Base URL not set for relative path");
      }
      if (base.startsWith("http://") || base.startsWith("https://") || base.startsWith("file://")) {
        const response = await fetch(`${base}/${this.path}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch music file: ${response.statusText}`);
        }
        return await response.arrayBuffer();
      }
      if (typeof window !== "undefined") {
        throw new Error("Relative paths are not supported in the browser");
      }
      return (await Promise.resolve().then(function () { return _polyfillNode_fs; })).readFileSync(`${base}/${this.path}`).buffer;
    }
    encodedLength() {
      return 1 + stringEncodedLength(this.path);
    }
    encode(output, offset) {
      output.setInt8(offset, this.compressed ? -3 : 3);
      offset++;
      offset = encodeString(this.path, output, offset);
      return [offset, []];
    }
    static decode(input, offset) {
      const compressed = input.getInt8(offset) < 0;
      offset++;
      const result = new _FileFromPath(decodeString(input, offset));
      result.compressed = compressed;
      return result;
    }
  };
  __publicField$2(_FileFromPath, "base");
  let FileFromPath = _FileFromPath;

  var __defProp$1 = Object.defineProperty;
  var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  class Chart {
    constructor(offset = 0, initialBps = 2, initialSpeed = 1) {
      /**
       * The chart author's name.
       */
      __publicField$1(this, "charter", "");
      /**
       * Any comments about the chart.
       */
      __publicField$1(this, "comments", "");
      /**
       * The offset of the chart in seconds.
       * This is the time in the music when the zeroth beat happens.
       */
      __publicField$1(this, "offset");
      __publicField$1(this, "bpsList");
      __publicField$1(this, "speedList");
      __publicField$1(this, "noteList");
      this.offset = offset;
      this.bpsList = new BpsList(initialBps);
      this.speedList = new SpeedList(initialSpeed);
      this.noteList = new NoteList();
    }
    /**
     * The y coordinate of a chart at some time is defined by the position of a 1D particle at that time
     * assuming that its velocity is piecewisely specified by the {@link speedList}.
     * 
     * @param time The time at which to find the y coordinate.
     * @returns The y coordinate at the given time.
     */
    yAt(time) {
      return this.speedList.yAt(time, this.bpsList);
    }
    /**
     * Similar to {@link yAt}, but takes a beat instead of time as the parameter.
     * 
     * @param beat The beat at which to find the y coordinate.
     * @returns The y coordinate at the given beat.
     */
    yAtBeat(beat) {
      return this.yAt(this.bpsList.timeAt(beat));
    }
    encodedLength() {
      return 4 + 1 + new TextEncoder().encode(this.charter).length + 1 + new TextEncoder().encode(this.comments).length + 1 + 8 + this.bpsList.encodedLength() + this.speedList.encodedLength() + this.noteList.encodedLength();
    }
    encode(output, offset) {
      output.setUint32(offset, 1129338691, true);
      offset += 4;
      output.setUint8(offset, 1);
      offset++;
      offset = encodeString(this.charter, output, offset);
      offset = encodeString(this.comments, output, offset);
      output.setFloat64(offset, this.offset);
      offset += 8;
      offset = this.bpsList.encode(output, offset);
      offset = this.speedList.encode(output, offset);
      offset = this.noteList.encode(output, offset);
      return offset;
    }
    static decode(input, offset) {
      const chart = new Chart();
      offset += 4;
      if (input.getUint8(offset) !== 1) {
        throw new Error("Unsupported version");
      }
      offset++;
      chart.charter = decodeString(input, offset);
      offset += stringEncodedLength(chart.charter);
      chart.comments = decodeString(input, offset);
      offset += stringEncodedLength(chart.comments);
      chart.offset = input.getFloat64(offset, true);
      offset += 8;
      chart.bpsList = BpsList.decode(input, offset);
      offset += chart.bpsList.encodedLength();
      chart.speedList = SpeedList.decode(input, offset);
      offset += chart.speedList.encodedLength();
      chart.noteList = NoteList.decode(input, offset);
      return chart;
    }
    beatToCbt(beat, startingMeasure = 0, beatsPerMeasure = 4) {
      const beatsPerMeasureFraction = new Fraction(beatsPerMeasure);
      const measure = beat.div(beatsPerMeasureFraction).floor();
      const beatInMeasure = beat.sub(measure.mul(beatsPerMeasureFraction)).div(beatsPerMeasureFraction);
      return [measure.valueOf() - startingMeasure, Number(beatInMeasure.n), Number(beatInMeasure.d)];
    }
    toCbt(beatsPerMeasure = 4) {
      const info = {
        bpm: this.bpsList.initialBpm() * beatsPerMeasure / 4,
        delay: 0,
        dir: ""
      };
      const offsetBeat = new Fraction(-this.offset * this.bpsList.initialBps);
      const startingMeasure = Math.min(Math.floor(-this.offset * this.bpsList.initialBps / beatsPerMeasure), 0);
      const [measure, subdivision, subdivisionCount] = this.beatToCbt(offsetBeat, startingMeasure, beatsPerMeasure);
      const notes = [[measure, 8, subdivisionCount, 0, subdivision, 1, "bgm"]];
      for (const bpsChange of this.bpsList.bpsChanges) {
        const [measure2, subdivision2, subdivisionCount2] = this.beatToCbt(bpsChange.beat, startingMeasure, beatsPerMeasure);
        notes.push([measure2, 8, subdivisionCount2, 0, subdivision2, 2, bpsChange.bpm() * beatsPerMeasure / 4]);
      }
      if (this.speedList.initialSpeed !== 1) {
        notes.push([0, 8, 4, 0, 0, 3, this.speedList.initialSpeed]);
      }
      for (const speedChange of this.speedList.speedChanges) {
        const [measure2, subdivision2, subdivisionCount2] = this.beatToCbt(speedChange.beat, startingMeasure, beatsPerMeasure);
        notes.push([measure2, 8, subdivisionCount2, 0, subdivision2, 3, speedChange.speed]);
      }
      let group = 0;
      const groups = /* @__PURE__ */ new WeakMap();
      for (const note of this.noteList.notes) {
        const [measure2, subdivision2, subdivisionCount2] = this.beatToCbt(note.beat, startingMeasure, beatsPerMeasure);
        const basicArgs = [measure2, note.trackCount, subdivisionCount2, note.trackIndex, subdivision2];
        if (note instanceof Tap) {
          notes.push([...basicArgs, ...note.width > 0 ? [40, note.width] : [10]]);
          continue;
        }
        const n = note;
        if (!groups.has(n.peers)) {
          groups.set(n.peers, group++);
        }
        let type;
        const args = [groups.get(n.peers)];
        if (n instanceof Hold) {
          if (n.isBegin()) {
            type = 20;
          } else if (n.isEnd()) {
            type = 21;
          } else {
            type = 22;
          }
          if (n.width > 0) {
            type += 30;
            args.push(n.width);
          }
        } else {
          if (!n.isBegin() && !n.isEnd()) {
            type = 31;
          } else if (n.isBegin()) {
            type = 30;
          } else {
            type = 32;
          }
        }
        notes.push([...basicArgs, type, ...args]);
      }
      return { info, notes };
    }
    static fromCbt(cbt, beatsPerMeasure = 4) {
      const chart = new Chart();
      chart.bpsList.initialBps = cbt.info.bpm / 60 * 4 / beatsPerMeasure;
      let offsetBeat;
      const groups = /* @__PURE__ */ new Map();
      for (const [measure, trackCount, subdivisionCount, trackIndex, subdivision, type, ...args] of cbt.notes) {
        const beat = new Fraction(measure * beatsPerMeasure, 1).add(subdivision * beatsPerMeasure, subdivisionCount);
        let note;
        let group;
        switch (type) {
          case 1:
            offsetBeat = beat;
            break;
          case 2:
            chart.bpsList.addBpmChange(beat, args[0]);
            break;
          case 3:
            chart.speedList.addSpeedChange(beat, args[0]);
            break;
          case 10:
          case 40:
            note = new Tap(beat, trackCount, trackIndex);
            chart.noteList.addNote(note);
            if (type === 40) {
              note.width = args[0];
            }
            break;
          case 20:
          case 21:
          case 22:
          case 50:
          case 51:
            note = new Hold(beat, trackCount, trackIndex);
            chart.noteList.addNote(note);
            if (type === 50 || type === 51) {
              note.width = args[1];
            }
            group = args[0];
            if (groups.has(group)) {
              note.mergeWith(groups.get(group));
            } else {
              groups.set(group, note);
            }
            break;
          case 30:
          case 31:
          case 32:
            note = new Drag(beat, trackCount, trackIndex);
            chart.noteList.addNote(note);
            group = args[0];
            if (groups.has(group)) {
              note.mergeWith(groups.get(group));
            } else {
              groups.set(group, note);
            }
            break;
        }
      }
      if (offsetBeat) {
        chart.offset = -chart.bpsList.timeAt(offsetBeat);
      }
      return chart;
    }
  }
  class ChartInfo {
    constructor() {
      /**
       * The name of the difficulty.
       * Usually one of `"EASY"`, `"NORMAL"`, `"HARD"`, `"EXTRA"`, `"EXTRA+"`, `"CHAOS"`, `"CHAOS+"`.
       */
      __publicField$1(this, "difficultyName", "EXTRA");
      /**
       * The text describing the difficulty level.
       * Usually the decimal representation of an integer from 1 to 13.
       */
      __publicField$1(this, "difficultyText", "10");
      /**
       * The color of this difficulty. Common values:
       * 
       * | Difficulty name | Color |
       * |-|-|
       * | EASY | `[0x00, 0x41, 0xe9]` |
       * | NORMAL | `[0xe9, 0x6e, 0x00]` |
       * | HARD | `[0xe9, 0x00, 0x2e]` |
       * | EXTRA, EXTRA+ | `[0xe9, 0x00, 0xad]` |
       * | CHAOS, CHAOS+ | `[0x4b, 0x4b, 0x9d]` |
       */
      __publicField$1(this, "difficultyColor", [233, 0, 173]);
      /**
       * A number that quantitatively describes the difficulty of this chart.
       * It should be 1000 times the actual difficulty level.
       * For example, if the difficulty level is 12.9, then this number should be 12900.
       */
      __publicField$1(this, "difficulty", 1e4);
      __publicField$1(this, "chartProvider");
      __publicField$1(this, "_chart");
    }
    /**
     * This loads the actual chart data by decoding them from {@link chartProvider}.
     * The decoding only happens once, and then the chart is cached
     * so that the promise from subsequent calls resolves immediately.
     * 
     * @returns Loaded chart.
     */
    async chart() {
      if (this._chart) {
        return this._chart;
      }
      this._chart = await this.chartProvider.chart();
      return this._chart;
    }
    /**
     * This replaces the chart data.
     * After this function is called, {@link chartProvider} will be set to `null`
     * (it will later be set to a new object when {@link encode} is called).
     * 
     * @param value The new chart.
     */
    setChart(value) {
      this._chart = value;
      this.chartProvider = null;
    }
    encodedLength() {
      return stringEncodedLength(this.difficultyName) + stringEncodedLength(this.difficultyText) + 3 + 4 + (this.chartProvider?.encodedLength() ?? 16);
    }
    /**
     * @see {@link Provider.totalEncodedLength}
     * @see {@link FileProvider.totalEncodedLength}
     */
    totalEncodeLength() {
      return stringEncodedLength(this.difficultyName) + stringEncodedLength(this.difficultyText) + 3 + 4 + (this.chartProvider?.totalEncodedLength() ?? 17 + this._chart.encodedLength());
    }
    encode(output, offset, compressed = false) {
      if (!this.chartProvider) {
        const arrayBuffer = new ArrayBuffer(this._chart.encodedLength());
        this._chart.encode(new DataView(arrayBuffer), 0);
        const fileEmbedded = new FileEmbedded();
        fileEmbedded.compressed = compressed;
        fileEmbedded.set(arrayBuffer);
        this.chartProvider = new ChartFromFileEmbedded(fileEmbedded);
      }
      offset = encodeString(this.difficultyName, output, offset);
      offset = encodeString(this.difficultyText, output, offset);
      for (let i = 0; i < 3; i++) {
        output.setUint8(offset, this.difficultyColor[i]);
        offset++;
      }
      output.setUint32(offset, this.difficulty, true);
      offset += 4;
      return this.chartProvider.encode(output, offset);
    }
    static decode(input, offset) {
      const chartInfo = new ChartInfo();
      chartInfo.difficultyName = decodeString(input, offset);
      offset += stringEncodedLength(chartInfo.difficultyName);
      chartInfo.difficultyText = decodeString(input, offset);
      offset += stringEncodedLength(chartInfo.difficultyText);
      for (let i = 0; i < 3; i++) {
        chartInfo.difficultyColor[i] = input.getUint8(offset);
        offset++;
      }
      chartInfo.difficulty = input.getUint32(offset, true);
      offset += 4;
      chartInfo.chartProvider = ChartProvider.decode(null, input, offset);
      return chartInfo;
    }
  }
  class ChartList {
    constructor() {
      __publicField$1(this, "charts", /* @__PURE__ */ new Map());
    }
    newChart(difficultyName) {
      const chartInfo = new ChartInfo();
      chartInfo.difficultyName = difficultyName;
      chartInfo.setChart(new Chart());
      this.charts.set(difficultyName, chartInfo);
      return chartInfo;
    }
    getChartInfo(difficultyName) {
      return this.charts.get(difficultyName);
    }
    encodedLength() {
      let length = 1;
      for (const chartInfo of this.charts.values()) {
        length += chartInfo.encodedLength();
      }
      return length;
    }
    totalEncodedLength() {
      let length = 1;
      for (const chartInfo of this.charts.values()) {
        length += chartInfo.totalEncodeLength();
      }
      return length;
    }
    encode(output, offset) {
      const embedRequests = [];
      output.setUint8(offset, this.charts.size);
      offset++;
      let newEmbedRequests;
      for (const chartInfo of this.charts.values()) {
        [offset, newEmbedRequests] = chartInfo.encode(output, offset);
        embedRequests.push(...newEmbedRequests);
      }
      return [offset, embedRequests];
    }
    static decode(input, offset) {
      const chartList = new ChartList();
      const chartCount = input.getUint8(offset);
      offset++;
      for (let i = 0; i < chartCount; i++) {
        const chartInfo = ChartInfo.decode(input, offset);
        offset += chartInfo.encodedLength();
        chartList.charts.set(chartInfo.difficultyName, chartInfo);
      }
      return chartList;
    }
  }

  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  class Music {
    constructor(musicProvider, previewProvider, coverProvider) {
      this.musicProvider = musicProvider;
      this.previewProvider = previewProvider;
      this.coverProvider = coverProvider;
      /**
       * The name of the music.
       */
      __publicField(this, "name", "");
      /**
       * The artist of the music.
       */
      __publicField(this, "artist", "");
      /**
       * The categories of the music represented as a bitmask.
       * All possible flags are:
       * 
       * | Flag | Meaning |
       * |-|-|
       * | `2` | |
       * | `4` | {@link instrumental} |
       * | `8` | {@link vocal} |
       * | `16` | |
       */
      __publicField(this, "categories", 0);
      /**
       * Keywords that intend to assist searching.
       */
      __publicField(this, "keywords", []);
      __publicField(this, "chartList", new ChartList());
    }
    /**
     * Implemented as reading the bitmask in {@link categories}.
     */
    get instrumental() {
      return !!(this.categories & 4);
    }
    /**
     * Implemented as writing the bitmask in {@link categories}.
     */
    set instrumental(value) {
      if (value) {
        this.categories |= 4;
      } else {
        this.categories &= -5;
      }
    }
    /**
     * Implemented as reading the bitmask in {@link categories}.
     */
    get vocal() {
      return !!(this.categories & 8);
    }
    /**
     * Implemented as writing the bitmask in {@link categories}.
     */
    set vocal(value) {
      if (value) {
        this.categories |= 8;
      } else {
        this.categories &= -9;
      }
    }
    newChart(difficultyName) {
      return this.chartList.newChart(difficultyName);
    }
    getChartInfo(difficultyName) {
      return this.chartList.getChartInfo(difficultyName);
    }
    chartCount() {
      return this.chartList.charts.size;
    }
    encodedLength() {
      return 4 + 1 + stringEncodedLength(this.name) + stringEncodedLength(this.artist) + 1 + this.musicProvider.totalEncodedLength() + this.previewProvider.totalEncodedLength() + this.coverProvider.totalEncodedLength() + 1 + this.keywords.reduce((sum, keyword) => sum + stringEncodedLength(keyword), 0) + this.chartList.totalEncodedLength();
    }
    encode(output, offset) {
      const embedRequests = [];
      output.setUint32(offset, 1297110851, true);
      offset += 4;
      output.setUint8(offset, 1);
      offset++;
      offset = encodeString(this.name, output, offset);
      offset = encodeString(this.artist, output, offset);
      output.setUint8(offset, this.categories);
      offset++;
      let newEmbedRequests;
      [offset, newEmbedRequests] = this.musicProvider.encode(output, offset);
      embedRequests.push(...newEmbedRequests);
      [offset, newEmbedRequests] = this.previewProvider.encode(output, offset);
      embedRequests.push(...newEmbedRequests);
      [offset, newEmbedRequests] = this.coverProvider.encode(output, offset);
      embedRequests.push(...newEmbedRequests);
      output.setUint8(offset, this.keywords.length);
      offset++;
      for (const keyword of this.keywords) {
        offset = encodeString(keyword, output, offset);
      }
      [offset, newEmbedRequests] = this.chartList.encode(output, offset);
      embedRequests.push(...newEmbedRequests);
      for (const embedRequest of embedRequests) {
        offset = embedRequest.write(output, offset);
      }
      return offset;
    }
    static decode(input, offset) {
      const music = new Music(null, null, null);
      offset += 4;
      if (input.getUint8(offset) !== 1) {
        throw new Error("Unsupported version");
      }
      offset++;
      music.name = decodeString(input, offset);
      offset += stringEncodedLength(music.name);
      music.artist = decodeString(input, offset);
      offset += stringEncodedLength(music.artist);
      music.categories = input.getUint8(offset);
      offset++;
      music.musicProvider = MusicProvider.decode(music, input, offset);
      offset += music.musicProvider.encodedLength();
      music.previewProvider = PreviewProvider.decode(music, input, offset);
      offset += music.previewProvider.encodedLength();
      music.coverProvider = CoverProvider.decode(music, input, offset);
      offset += music.coverProvider.encodedLength();
      const keywordCount = input.getUint8(offset);
      offset++;
      music.keywords = [];
      for (let i = 0; i < keywordCount; i++) {
        const keyword = decodeString(input, offset);
        offset += stringEncodedLength(keyword);
        music.keywords.push(keyword);
      }
      music.chartList = ChartList.decode(input, offset);
      return music;
    }
  }

  var _polyfillNode_fs = /*#__PURE__*/Object.freeze({
    __proto__: null
  });

  exports.BpsChange = BpsChange;
  exports.BpsList = BpsList;
  exports.Chart = Chart;
  exports.ChartFromFileEmbedded = ChartFromFileEmbedded;
  exports.ChartInfo = ChartInfo;
  exports.ChartList = ChartList;
  exports.ChartProvider = ChartProvider;
  exports.CoverEmptyProvider = CoverEmptyProvider;
  exports.CoverFromFileProvider = CoverFromFileProvider;
  exports.CoverProvider = CoverProvider;
  exports.Drag = Drag;
  exports.EmbedRequest = EmbedRequest;
  exports.FileEmbedded = FileEmbedded;
  exports.FileFromPath = FileFromPath;
  exports.FileFromUrl = FileFromUrl;
  exports.FileProvider = FileProvider;
  exports.GroupableNote = GroupableNote;
  exports.Hold = Hold;
  exports.Music = Music;
  exports.MusicFromFileProvider = MusicFromFileProvider;
  exports.MusicProvider = MusicProvider;
  exports.Note = Note;
  exports.NoteList = NoteList;
  exports.PreviewFromFileProvider = PreviewFromFileProvider;
  exports.PreviewFromMusicProvider = PreviewFromMusicProvider;
  exports.PreviewProvider = PreviewProvider;
  exports.Provider = Provider;
  exports.SpeedChange = SpeedChange;
  exports.SpeedList = SpeedList;
  exports.Tap = Tap;

})(this.CharWasP = this.CharWasP || {});
//# sourceMappingURL=index.iife.js.map

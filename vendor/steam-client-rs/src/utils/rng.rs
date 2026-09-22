//! Random number generator abstraction for testable randomness.
//!
//! This module provides an `Rng` trait that abstracts random number generation,
//! enabling deterministic testing of code that uses randomness.
//!
//! # Example
//!
//! ```rust
//! use steam_client::utils::rng::{MockRng, Rng, ThreadRng};
//!
//! // Production: use ThreadRng
//! let rng = ThreadRng;
//! let value = rng.gen_usize(100);
//!
//! // Testing: use MockRng for deterministic tests
//! let mock = MockRng::new();
//! mock.set_usize(42);
//! assert_eq!(mock.gen_usize(100), 42);
//! ```

use parking_lot::Mutex;
use rand::Rng as _;

/// Trait for generating random numbers.
///
/// This trait abstracts random number generation, allowing mock implementations
/// for deterministic testing of randomness-dependent logic.
pub trait Rng: Send + Sync {
    /// Generate a random usize in the range [0, max).
    fn gen_usize(&self, max: usize) -> usize;

    /// Generate a random i32.
    fn gen_i32(&self) -> i32;

    /// Generate a random u32.
    fn gen_u32(&self) -> u32;

    /// Generate a random u64.
    fn gen_u64(&self) -> u64;

    /// Generate a vector of random bytes of the specified length.
    fn gen_bytes(&self, len: usize) -> Vec<u8>;
}

/// Thread-local random number generator using the system RNG.
///
/// This is the default RNG used in production code.
#[derive(Debug, Clone, Copy, Default)]
pub struct ThreadRng;

impl Rng for ThreadRng {
    fn gen_usize(&self, max: usize) -> usize {
        if max == 0 {
            return 0;
        }
        rand::rng().random_range(0..max)
    }

    fn gen_i32(&self) -> i32 {
        rand::rng().random::<i32>()
    }

    fn gen_u32(&self) -> u32 {
        rand::rng().random::<u32>()
    }

    fn gen_u64(&self) -> u64 {
        rand::rng().random::<u64>()
    }

    fn gen_bytes(&self, len: usize) -> Vec<u8> {
        let mut bytes = vec![0u8; len];
        rand::RngCore::fill_bytes(&mut rand::rng(), &mut bytes[..]);
        bytes
    }
}

impl steam_cm_provider::CmRng for ThreadRng {
    fn gen_u32(&self) -> u32 {
        rand::rng().random::<u32>()
    }

    fn gen_usize(&self, max: usize) -> usize {
        if max == 0 {
            return 0;
        }
        rand::rng().random_range(0..max)
    }
}

/// Mock random number generator for testing.
///
/// Allows tests to control exactly what values are returned by RNG calls.
///
/// # Example
///
/// ```rust
/// use steam_client::utils::rng::{MockRng, Rng};
///
/// let mock = MockRng::new();
///
/// // Set specific values to be returned
/// mock.set_usize(5);
/// assert_eq!(mock.gen_usize(100), 5);
///
/// // Values can be changed at any time
/// mock.set_usize(10);
/// assert_eq!(mock.gen_usize(100), 10);
/// ```
#[derive(Debug)]
pub struct MockRng {
    usize_value: Mutex<usize>,
    i32_value: Mutex<i32>,
    u32_value: Mutex<u32>,
    u64_value: Mutex<u64>,
    bytes_value: Mutex<Vec<u8>>,
}

impl MockRng {
    /// Create a new mock RNG with default values (all zeros).
    pub fn new() -> Self {
        Self {
            usize_value: Mutex::new(0),
            i32_value: Mutex::new(0),
            u32_value: Mutex::new(0),
            u64_value: Mutex::new(0),
            bytes_value: Mutex::new(Vec::new()),
        }
    }

    /// Create a new mock RNG with specific initial values.
    pub fn with_values(usize_val: usize, i32_val: i32, u32_val: u32) -> Self {
        Self::with_all_values(usize_val, i32_val, u32_val, 0, Vec::new())
    }

    /// Create a new mock RNG with all initial values including u64 and bytes.
    pub fn with_all_values(usize_val: usize, i32_val: i32, u32_val: u32, u64_val: u64, bytes_val: Vec<u8>) -> Self {
        Self {
            usize_value: Mutex::new(usize_val),
            i32_value: Mutex::new(i32_val),
            u32_value: Mutex::new(u32_val),
            u64_value: Mutex::new(u64_val),
            bytes_value: Mutex::new(bytes_val),
        }
    }

    /// Set the value to be returned by `gen_usize`.
    pub fn set_usize(&self, value: usize) {
        *self.usize_value.lock() = value;
    }

    /// Set the value to be returned by `gen_i32`.
    pub fn set_i32(&self, value: i32) {
        *self.i32_value.lock() = value;
    }

    /// Set the value to be returned by `gen_u32`.
    pub fn set_u32(&self, value: u32) {
        *self.u32_value.lock() = value;
    }

    /// Set the value to be returned by `gen_u64`.
    pub fn set_u64(&self, value: u64) {
        *self.u64_value.lock() = value;
    }

    /// Set the value to be returned by `gen_bytes`.
    pub fn set_bytes(&self, value: Vec<u8>) {
        *self.bytes_value.lock() = value;
    }

    /// Get the current usize value.
    pub fn current_usize(&self) -> usize {
        *self.usize_value.lock()
    }

    /// Get the current i32 value.
    pub fn current_i32(&self) -> i32 {
        *self.i32_value.lock()
    }

    /// Get the current u32 value.
    pub fn current_u32(&self) -> u32 {
        *self.u32_value.lock()
    }

    /// Get the current u64 value.
    pub fn current_u64(&self) -> u64 {
        *self.u64_value.lock()
    }

    /// Get the current bytes value.
    pub fn current_bytes(&self) -> Vec<u8> {
        self.bytes_value.lock().clone()
    }
}

impl Default for MockRng {
    fn default() -> Self {
        Self::new()
    }
}

impl Rng for MockRng {
    fn gen_usize(&self, _max: usize) -> usize {
        *self.usize_value.lock()
    }

    fn gen_i32(&self) -> i32 {
        *self.i32_value.lock()
    }

    fn gen_u32(&self) -> u32 {
        *self.u32_value.lock()
    }

    fn gen_u64(&self) -> u64 {
        *self.u64_value.lock()
    }

    fn gen_bytes(&self, len: usize) -> Vec<u8> {
        let val = self.bytes_value.lock();
        if val.is_empty() {
            vec![0; len]
        } else {
            // Return stored bytes, truncated or padded to requested length
            let mut result = val.clone();
            result.resize(len, 0);
            result
        }
    }
}

impl steam_cm_provider::CmRng for MockRng {
    fn gen_u32(&self) -> u32 {
        *self.u32_value.lock()
    }

    fn gen_usize(&self, _max: usize) -> usize {
        *self.usize_value.lock()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_thread_rng_gen_usize() {
        let rng = ThreadRng;
        // Just verify it doesn't panic and returns valid range
        for _ in 0..100 {
            let value = rng.gen_usize(10);
            assert!(value < 10);
        }
    }

    #[test]
    fn test_thread_rng_gen_usize_zero_max() {
        let rng = ThreadRng;
        assert_eq!(rng.gen_usize(0), 0);
    }

    #[test]
    fn test_mock_rng_default_values() {
        let mock = MockRng::new();
        assert_eq!(mock.gen_usize(100), 0);
        assert_eq!(mock.gen_i32(), 0);
        assert_eq!(mock.gen_u32(), 0);
    }

    #[test]
    fn test_mock_rng_with_values() {
        let mock = MockRng::with_values(42, -123, 456);
        assert_eq!(mock.gen_usize(100), 42);
        assert_eq!(mock.gen_i32(), -123);
        assert_eq!(mock.gen_u32(), 456);
    }

    #[test]
    fn test_mock_rng_set_values() {
        let mock = MockRng::new();

        mock.set_usize(100);
        assert_eq!(mock.gen_usize(1000), 100);

        mock.set_i32(-999);
        assert_eq!(mock.gen_i32(), -999);

        mock.set_u32(12345);
        assert_eq!(mock.gen_u32(), 12345);
    }

    #[test]
    fn test_mock_rng_ignores_max() {
        let mock = MockRng::new();
        mock.set_usize(50);

        // MockRng ignores the max parameter - it's the caller's responsibility
        // to ensure test values are valid for the use case
        assert_eq!(mock.gen_usize(10), 50);
        assert_eq!(mock.gen_usize(100), 50);
        assert_eq!(mock.gen_usize(1000), 50);
    }

    #[test]
    fn test_mock_rng_current_values() {
        let mock = MockRng::with_values(1, 2, 3);

        assert_eq!(mock.current_usize(), 1);
        assert_eq!(mock.current_i32(), 2);
        assert_eq!(mock.current_u32(), 3);

        mock.set_usize(10);
        assert_eq!(mock.current_usize(), 10);
    }

    #[test]
    fn test_thread_rng_gen_bytes() {
        let rng = ThreadRng;
        let bytes = rng.gen_bytes(10);
        assert_eq!(bytes.len(), 10);
    }

    #[test]
    fn test_mock_rng_bytes() {
        let mock = MockRng::new();

        // Default should be zeros
        let bytes = mock.gen_bytes(5);
        assert_eq!(bytes, vec![0, 0, 0, 0, 0]);

        // Set bytes
        let test_bytes = vec![1, 2, 3, 4, 5];
        mock.set_bytes(test_bytes.clone());
        assert_eq!(mock.gen_bytes(5), test_bytes);
        assert_eq!(mock.current_bytes(), test_bytes);

        // Test resizing behavior
        assert_eq!(mock.gen_bytes(3), vec![1, 2, 3]);
        assert_eq!(mock.gen_bytes(7), vec![1, 2, 3, 4, 5, 0, 0]);
    }
}

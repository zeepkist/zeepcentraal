//! Currency formatting utilities.
//!
//! Ported from `node-steam-user`.

use steam_enums::ECurrencyCode;

struct CurrencyFormat {
    prepend: Option<&'static str>,
    append: Option<&'static str>,
    commas: bool,
    whole: bool,
}

impl CurrencyFormat {
    const fn new(prepend: Option<&'static str>, append: Option<&'static str>, commas: bool, whole: bool) -> Self {
        Self { prepend, append, commas, whole }
    }
}

fn get_currency_format(code: ECurrencyCode) -> Option<CurrencyFormat> {
    match code {
        ECurrencyCode::USD => Some(CurrencyFormat::new(Some("$"), None, false, false)),
        ECurrencyCode::GBP => Some(CurrencyFormat::new(Some("\u{00a3}"), None, false, false)),
        ECurrencyCode::EUR => Some(CurrencyFormat::new(None, Some("\u{20ac}"), true, false)),
        ECurrencyCode::CHF => Some(CurrencyFormat::new(None, Some(" CHF"), false, false)),
        ECurrencyCode::RUB => Some(CurrencyFormat::new(None, Some(" p\u{0443}\u{0431}."), true, true)),
        ECurrencyCode::PLN => Some(CurrencyFormat::new(None, Some(" PLN"), false, false)),
        ECurrencyCode::BRL => Some(CurrencyFormat::new(None, Some(" R$"), true, false)),
        ECurrencyCode::JPY => Some(CurrencyFormat::new(Some("\u{00a5} "), None, false, true)),
        ECurrencyCode::NOK => Some(CurrencyFormat::new(None, Some(" kr"), true, false)),
        ECurrencyCode::IDR => Some(CurrencyFormat::new(Some("Rp "), None, false, false)),
        ECurrencyCode::MYR => Some(CurrencyFormat::new(Some("RM "), None, false, false)),
        ECurrencyCode::PHP => Some(CurrencyFormat::new(Some("P "), None, false, false)),
        ECurrencyCode::SGD => Some(CurrencyFormat::new(Some("S$ "), None, false, false)),
        ECurrencyCode::THB => Some(CurrencyFormat::new(Some("\u{0e3f} "), None, false, false)),
        ECurrencyCode::VND => Some(CurrencyFormat::new(None, Some(" VND"), false, false)),
        ECurrencyCode::KRW => Some(CurrencyFormat::new(Some("\u{20a9}"), None, false, true)),
        ECurrencyCode::TRY => Some(CurrencyFormat::new(None, Some(" TRY"), false, false)),
        ECurrencyCode::UAH => Some(CurrencyFormat::new(None, Some(" UAH"), false, false)),
        ECurrencyCode::MXN => Some(CurrencyFormat::new(Some("Mex$ "), None, false, false)),
        ECurrencyCode::CAD => Some(CurrencyFormat::new(Some("CDN$ "), None, false, false)),
        ECurrencyCode::AUD => Some(CurrencyFormat::new(Some("A$ "), None, false, false)),
        ECurrencyCode::NZD => Some(CurrencyFormat::new(Some("NZ$ "), None, false, false)),
        ECurrencyCode::CNY => Some(CurrencyFormat::new(None, Some(" CNY"), false, false)),
        ECurrencyCode::INR => Some(CurrencyFormat::new(None, Some(" INR"), false, false)),
        ECurrencyCode::CLP => Some(CurrencyFormat::new(None, Some(" CLP"), false, false)),
        ECurrencyCode::PEN => Some(CurrencyFormat::new(None, Some(" PEN"), false, false)),
        ECurrencyCode::COP => Some(CurrencyFormat::new(None, Some(" COP"), false, false)),
        ECurrencyCode::ZAR => Some(CurrencyFormat::new(None, Some(" ZAR"), false, false)),
        ECurrencyCode::HKD => Some(CurrencyFormat::new(None, Some(" HKD"), false, false)),
        ECurrencyCode::TWD => Some(CurrencyFormat::new(None, Some(" TWD"), false, false)),
        ECurrencyCode::SAR => Some(CurrencyFormat::new(None, Some(" SAR"), false, false)),
        ECurrencyCode::AED => Some(CurrencyFormat::new(None, Some(" AED"), false, false)),
        _ => None,
    }
}

/// Format a currency amount.
///
/// # Arguments
/// * `amount` - The amount to format
/// * `currency` - The currency code
pub fn format_currency(amount: f32, currency: ECurrencyCode) -> String {
    // Basic string formatting to 2 decimal places
    let mut amount_string = format!("{:.2}", amount);

    // If we don't have data for this currency, return basic formatting
    let data = match get_currency_format(currency) {
        Some(d) => d,
        None => return amount_string,
    };

    if data.whole {
        amount_string = amount_string.replace(".00", "");
    }

    if data.commas {
        amount_string = amount_string.replace('.', ",");
    }

    let mut result = String::new();

    if let Some(prepend) = data.prepend {
        result.push_str(prepend);
    }

    result.push_str(&amount_string);

    if let Some(append) = data.append {
        result.push_str(append);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_usd() {
        assert_eq!(format_currency(12.50, ECurrencyCode::USD), "$12.50");
        assert_eq!(format_currency(10.00, ECurrencyCode::USD), "$10.00");
    }

    #[test]
    fn test_format_eur() {
        // EUR uses commas and appends symbol
        assert_eq!(format_currency(12.50, ECurrencyCode::EUR), "12,50\u{20ac}");
    }

    #[test]
    fn test_format_jpy() {
        // JPY is whole numbers only if .00
        assert_eq!(format_currency(100.00, ECurrencyCode::JPY), "\u{00a5} 100");

        assert_eq!(format_currency(100.50, ECurrencyCode::JPY), "\u{00a5} 100.50");
    }
}

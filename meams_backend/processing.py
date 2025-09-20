import pandas as pd
import numpy as np
from statsmodels.tsa.statespace.sarimax import SARIMAX
import warnings

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')


def bootstrap_years(df: pd.DataFrame, date_col='date', value_col='quantity',
                    start_year=2021, end_year=2024, noise_level=0.05) -> pd.DataFrame:
    """
    Bootstrap synthetic years from a single year (e.g., 2023) by adding noise.
    Returns a dataset spanning start_year–end_year.
    """
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.set_index(date_col).sort_index()

    # Extract base year (assume it's 2023)
    base_year = df.index.year.unique()[0]
    base_values = df[value_col].values

    bootstrapped = []
    for year in range(start_year, end_year + 1):
        for month in range(1, 13):
            base_idx = month - 1
            value = base_values[base_idx]
            noisy_value = value * (1 + np.random.uniform(-noise_level, noise_level))
            bootstrapped.append({
                date_col: pd.Timestamp(year=year, month=month, day=1),
                value_col: noisy_value
            })

    return pd.DataFrame(bootstrapped).sort_values(by=date_col).reset_index(drop=True)


def find_best_sarima_order(data, seasonal_period=12,
                           max_p=2, max_d=1, max_q=2,
                           max_P=1, max_D=1, max_Q=1):
    """
    Grid search for the best SARIMA order using AIC.
    """
    best_aic = float('inf')
    best_order = (1, 1, 1)
    best_seasonal_order = (0, 1, 1, seasonal_period)

    for p in range(max_p + 1):
        for d in range(max_d + 1):
            for q in range(max_q + 1):
                for P in range(max_P + 1):
                    for D in range(max_D + 1):
                        for Q in range(max_Q + 1):
                            try:
                                model = SARIMAX(
                                    data,
                                    order=(p, d, q),
                                    seasonal_order=(P, D, Q, seasonal_period),
                                    enforce_stationarity=False,
                                    enforce_invertibility=False
                                )
                                result = model.fit(disp=False)
                                if result.aic < best_aic:
                                    best_aic = result.aic
                                    best_order = (p, d, q)
                                    best_seasonal_order = (P, D, Q, seasonal_period)
                            except:
                                continue
    return best_order, best_seasonal_order


def generate_sarima_forecast(df: pd.DataFrame, date_col='date', value_col='quantity',
                             n_periods=12, seasonal_period=12) -> pd.DataFrame:
    """
    Fit SARIMA model and forecast next n_periods months.
    """
    if df.empty or len(df) < 12:
        return pd.DataFrame(columns=[date_col, value_col, 'lower_bound', 'upper_bound'])

    df = df.sort_values(by=date_col).set_index(date_col)

    # Find best SARIMA order
    order, seasonal_order = find_best_sarima_order(df[value_col], seasonal_period=seasonal_period)

    # Fit SARIMA
    model = SARIMAX(df[value_col], order=order, seasonal_order=seasonal_order,
                    enforce_stationarity=False, enforce_invertibility=False)
    result = model.fit(disp=False)

    # Forecast
    forecast_obj = result.get_forecast(steps=n_periods)
    forecast_mean = forecast_obj.predicted_mean
    conf_int = forecast_obj.conf_int()

    # Forecast dates
    last_date = df.index.max()
    forecast_dates = [last_date + pd.DateOffset(months=i) for i in range(1, n_periods + 1)]

    forecast_df = pd.DataFrame({
        date_col: forecast_dates,
        value_col: forecast_mean.values,
        'lower_bound': conf_int.iloc[:, 0].values.clip(min=0),
        'upper_bound': conf_int.iloc[:, 1].values.clip(min=0)
    })

    return forecast_df

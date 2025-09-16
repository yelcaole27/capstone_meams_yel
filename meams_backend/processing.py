import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.seasonal import seasonal_decompose
import warnings

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')

def bootstrap_missing_months(df: pd.DataFrame, date_col='date', value_col='quantity') -> pd.DataFrame:
    """
    Fill missing months in the time series by resampling monthly and filling gaps with zeros.
    """
    df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
    df = df.dropna(subset=[date_col])
    if df.empty:
        return pd.DataFrame(columns=[date_col, value_col])
    df_resampled = df.set_index(date_col).resample('MS').mean(numeric_only=True).reset_index()
    df_resampled[value_col] = df_resampled[value_col].fillna(0)
    return df_resampled

def find_best_arima_order(data, max_p=3, max_d=2, max_q=3):
    """
    Find the best ARIMA order using AIC criterion.
    """
    best_aic = float('inf')
    best_order = (1, 1, 1)
    
    for p in range(max_p + 1):
        for d in range(max_d + 1):
            for q in range(max_q + 1):
                try:
                    model = ARIMA(data, order=(p, d, q))
                    fitted_model = model.fit()
                    aic = fitted_model.aic
                    if aic < best_aic:
                        best_aic = aic
                        best_order = (p, d, q)
                except:
                    continue
    
    return best_order

def generate_arima_forecast(df: pd.DataFrame, date_col='date', value_col='quantity', n_periods=12) -> pd.DataFrame:
    """
    Generate ARIMA forecast for the next n_periods months using statsmodels.
    """
    if df.empty or len(df) < 2:
        return pd.DataFrame(columns=[date_col, value_col, 'lower_bound', 'upper_bound'])
    
    df = df.sort_values(by=date_col).set_index(date_col)
    
    try:
        # Ensure we have enough data points
        if len(df) < 10:
            # Use simple ARIMA(1,1,1) for small datasets
            order = (1, 1, 1)
        else:
            # Find best order for larger datasets
            order = find_best_arima_order(df[value_col])
        
        # Fit ARIMA model
        model = ARIMA(df[value_col], order=order)
        fitted_model = model.fit()
        
        # Generate forecast
        forecast_result = fitted_model.forecast(steps=n_periods)
        conf_int = fitted_model.get_forecast(steps=n_periods).conf_int()
        
        # Create forecast dates
        last_date = df.index.max()
        forecast_dates = [last_date + pd.DateOffset(months=i) for i in range(1, n_periods + 1)]
        
        # Create forecast dataframe
        forecast_df = pd.DataFrame({
            date_col: forecast_dates,
            value_col: forecast_result.values,
            'lower_bound': conf_int.iloc[:, 0].values,
            'upper_bound': conf_int.iloc[:, 1].values
        })
        
        # Ensure non-negative values
        forecast_df[value_col] = forecast_df[value_col].clip(lower=0)
        forecast_df['lower_bound'] = forecast_df['lower_bound'].clip(lower=0)
        forecast_df['upper_bound'] = forecast_df['upper_bound'].clip(lower=0)
        
        return forecast_df
        
    except Exception as e:
        print(f"ARIMA forecasting error: {e}")
        # Return a simple linear trend forecast as fallback
        try:
            return generate_simple_forecast(df, date_col, value_col, n_periods)
        except:
            return pd.DataFrame(columns=[date_col, value_col, 'lower_bound', 'upper_bound'])

def generate_simple_forecast(df: pd.DataFrame, date_col='date', value_col='quantity', n_periods=12) -> pd.DataFrame:
    """
    Generate a simple linear trend forecast as fallback.
    """
    # Calculate simple trend
    df_indexed = df.reset_index()
    df_indexed['period'] = range(len(df_indexed))
    
    # Simple linear regression
    x = df_indexed['period'].values
    y = df_indexed[value_col].values
    
    # Calculate slope and intercept
    slope = np.polyfit(x, y, 1)[0]
    last_value = y[-1]
    
    # Generate forecasts
    last_date = df.index.max()
    forecast_dates = [last_date + pd.DateOffset(months=i) for i in range(1, n_periods + 1)]
    
    forecasts = []
    for i in range(1, n_periods + 1):
        forecast_value = max(0, last_value + slope * i)
        forecasts.append(forecast_value)
    
    # Simple confidence intervals (±20% of forecast value)
    forecast_df = pd.DataFrame({
        date_col: forecast_dates,
        value_col: forecasts,
        'lower_bound': [max(0, f * 0.8) for f in forecasts],
        'upper_bound': [f * 1.2 for f in forecasts]
    })
    
    return forecast_df
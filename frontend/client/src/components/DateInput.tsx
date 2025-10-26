import React, { useState, useEffect } from 'react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  style?: React.CSSProperties;
  placeholder?: string;
}

const DateInput: React.FC<DateInputProps> = ({ value, onChange, required, style, placeholder }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);
    
    // Convert dd/mm/yyyy to yyyy-mm-dd for the API
    if (inputValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [day, month, year] = inputValue.split('/');
      const isoDate = `${year}-${month}-${day}`;
      onChange(isoDate);
    } else if (inputValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // If it's already in ISO format, keep it
      onChange(inputValue);
    } else {
      // For partial input, just update display
      onChange(inputValue);
    }
  };

  const handleBlur = () => {
    // If the input is not in the correct format, try to format it
    if (displayValue && !displayValue.match(/^\d{2}\/\d{2}\/\d{4}$/) && !displayValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Try to parse and format the date
      const date = new Date(displayValue);
      if (!isNaN(date.getTime())) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;
        setDisplayValue(formattedDate);
        onChange(`${year}-${month}-${day}`);
      }
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      required={required}
      style={style}
      placeholder={placeholder || "dd/mm/yyyy"}
      pattern="\d{2}/\d{2}/\d{4}"
    />
  );
};

export default DateInput;


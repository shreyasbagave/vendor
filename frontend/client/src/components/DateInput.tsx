import React from 'react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  style?: React.CSSProperties;
  placeholder?: string;
}

const DateInput: React.FC<DateInputProps> = ({ value, onChange, required, style, placeholder }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // HTML date input always provides YYYY-MM-DD format (ISO8601)
    onChange(e.target.value);
  };

  return (
    <input
      type="date"
      value={value}
      onChange={handleChange}
      required={required}
      style={style}
      placeholder={placeholder}
    />
  );
};

export default DateInput;


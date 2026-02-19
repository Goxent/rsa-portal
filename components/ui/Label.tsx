import React, { LabelHTMLAttributes } from 'react';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean;
}

const Label: React.FC<LabelProps> = ({
    className = '',
    children,
    required,
    ...props
}) => {
    return (
        <label
            className={`block text-sm font-medium text-gray-300 mb-1.5 ${className}`}
            {...props}
        >
            {children}
            {required && <span className="text-red-400 ml-1">*</span>}
        </label>
    );
};

export default Label;

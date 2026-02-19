import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import { convertADToBS, convertBSToAD, nepaliMonths } from '../utils/nepaliDate';

interface NepaliDatePickerProps {
    value: string; // AD date string (YYYY-MM-DD)
    onChange: (adDate: string, bsDate: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    showADDate?: boolean; // Show AD date alongside BS
}

const NepaliDatePicker: React.FC<NepaliDatePickerProps> = ({
    value,
    onChange,
    placeholder = "Select Date...",
    className = "",
    disabled = false,
    showADDate = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentYear, setCurrentYear] = useState(2082);
    const [currentMonth, setCurrentMonth] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initialize calendar to current BS date or selected date
    useEffect(() => {
        if (value) {
            const bsDate = convertADToBS(value);
            if (bsDate) {
                const [year, month] = bsDate.split('-').map(Number);
                setCurrentYear(year);
                setCurrentMonth(month - 1);
            }
        } else {
            const now = new NepaliDate();
            setCurrentYear(now.getYear());
            setCurrentMonth(now.getMonth());
        }
    }, [value]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Get days in BS month
    const getDaysInMonth = (year: number, month: number): number => {
        try {
            // month is 0-indexed in state, nepali-date-converter also uses 0-indexed month
            const np = new NepaliDate(year, month, 1);
            // Month is 0-indexed. We try to find the last valid day by rolling back from 32
            for (let d = 32; d >= 28; d--) {
                const test = new NepaliDate(year, month, d);
                // If it successfully created the date and it hasn't rolled over to next month
                if (test.getMonth() === month && test.getDate() === d) {
                    return d;
                }
            }
            return 30;
        } catch {
            return 30;
        }
    };

    // Get the day of the week for the first day of the month (0 = Sunday, 6 = Saturday)
    const getFirstDayOfMonth = (year: number, month: number): number => {
        try {
            const np = new NepaliDate(year, month, 1);
            return np.getDay();
        } catch {
            return 0;
        }
    };

    const handleDateSelect = (day: number) => {
        const bsDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const adDateStr = convertBSToAD(bsDateStr);
        onChange(adDateStr, bsDateStr);
        setIsOpen(false);
    };

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('', '');
    };

    // Get display value
    const getDisplayValue = () => {
        if (!value) return placeholder;
        const bsDate = convertADToBS(value);
        if (!bsDate) return value;

        const [year, month, day] = bsDate.split('-').map(Number);
        const monthName = nepaliMonths[month - 1] || '';

        if (showADDate) {
            return `${day} ${monthName} ${year} (${value})`;
        }
        return `${day} ${monthName} ${year}`;
    };

    // Get selected day for highlighting
    const getSelectedDay = (): number | null => {
        if (!value) return null;
        const bsDate = convertADToBS(value);
        if (!bsDate) return null;
        const [year, month, day] = bsDate.split('-').map(Number);
        if (year === currentYear && month - 1 === currentMonth) {
            return day;
        }
        return null;
    };

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const selectedDay = getSelectedDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const padding = Array.from({ length: firstDay }, (_, i) => i);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div
                className={`w-full glass-input rounded-lg px-3 py-2 text-sm min-h-[42px] flex items-center justify-between cursor-pointer border border-white/10 hover:border-brand-500/50 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isOpen ? 'ring-2 ring-brand-500/30 border-brand-500 shadow-xl' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="flex items-center flex-1 overflow-hidden">
                    <Calendar size={16} className="text-brand-400 mr-2 shrink-0" />
                    <span className={value ? 'text-gray-200' : 'text-gray-500'}>
                        {getDisplayValue()}
                    </span>
                </div>
                <div className="flex items-center">
                    {value && !disabled && (
                        <X
                            size={14}
                            className="text-gray-500 hover:text-white cursor-pointer mr-2"
                            onClick={handleClear}
                        />
                    )}
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-[100] top-full left-0 right-0 mt-2 bg-navy-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={handlePrevMonth}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={18} className="text-gray-400" />
                        </button>
                        <div className="text-center">
                            <span className="text-white font-medium">
                                {nepaliMonths[currentMonth]} {currentYear}
                            </span>
                        </div>
                        <button
                            onClick={handleNextMonth}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ChevronRight size={18} className="text-gray-400" />
                        </button>
                    </div>

                    {/* Day names */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-center text-[10px] text-gray-500 font-medium py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {padding.map((_, i) => (
                            <div key={`pad-${i}`} />
                        ))}
                        {days.map(day => (
                            <button
                                key={day}
                                onClick={() => handleDateSelect(day)}
                                className={`p-2 text-sm rounded-lg transition-colors ${selectedDay === day
                                    ? 'bg-brand-600 text-white font-bold'
                                    : 'text-gray-300 hover:bg-white/10'
                                    }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>

                    {/* Today button */}
                    <div className="mt-3 pt-3 border-t border-white/10">
                        <button
                            onClick={() => {
                                const today = new NepaliDate();
                                setCurrentYear(today.getYear());
                                setCurrentMonth(today.getMonth());
                                const bsStr = today.format('YYYY-MM-DD');
                                const adStr = convertBSToAD(bsStr);
                                onChange(adStr, bsStr);
                                setIsOpen(false);
                            }}
                            className="w-full text-center text-sm text-brand-400 hover:text-brand-300 py-1"
                        >
                            Today: {new NepaliDate().format('DD MMMM YYYY')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NepaliDatePicker;

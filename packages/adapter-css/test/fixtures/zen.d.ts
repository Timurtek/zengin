import * as react_jsx_runtime from 'react/jsx-runtime';
import { Accordion as Accordion$1 } from '@base-ui/react/accordion';
import * as react from 'react';
import { ReactNode, HTMLAttributes, ReactElement, CSSProperties, LiHTMLAttributes, MouseEvent, ComponentProps, Key, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, RefObject } from 'react';
import * as tailwind_variants from 'tailwind-variants';
import { VariantProps } from 'tailwind-variants';
import { Avatar as Avatar$1 } from '@base-ui/react/avatar';
import { ButtonProps as ButtonProps$1 } from '@base-ui/react/button';
import { Separator as Separator$1 } from '@base-ui/react/separator';
import { DayPicker } from 'react-day-picker';
import useEmblaCarousel from 'embla-carousel-react';
import { CheckboxRoot } from '@base-ui/react/checkbox';
import { CheckboxGroup as CheckboxGroup$1 } from '@base-ui/react/checkbox-group';
import { Collapsible as Collapsible$1 } from '@base-ui/react/collapsible';

declare const button: tailwind_variants.TVReturnType<{
    variant: {
        default: string[];
        primary: string[];
        outline: string[];
        quiet: string[];
        danger: string[];
        zero: string[];
    };
    size: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
        xl: string;
    };
}, undefined, string[], {
    variant: {
        default: string[];
        primary: string[];
        outline: string[];
        quiet: string[];
        danger: string[];
        zero: string[];
    };
    size: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
        xl: string;
    };
}, undefined, tailwind_variants.TVReturnType<{
    variant: {
        default: string[];
        primary: string[];
        outline: string[];
        quiet: string[];
        danger: string[];
        zero: string[];
    };
    size: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
        xl: string;
    };
}, undefined, string[], unknown, unknown, undefined>>;

type ButtonVariants = VariantProps<typeof button>;

declare const badge: tailwind_variants.TVReturnType<{
    variant: {
        default: string;
        primary: string;
        outline: string;
        success: string;
        warning: string;
        error: string;
        info: string;
        slate: string;
        gray: string;
        zinc: string;
        neutral: string;
        stone: string;
        red: string;
        orange: string;
        amber: string;
        yellow: string;
        lime: string;
        green: string;
        emerald: string;
        teal: string;
        cyan: string;
        sky: string;
        blue: string;
        indigo: string;
        violet: string;
        purple: string;
        fuchsia: string;
        pink: string;
        rose: string;
    };
    size: {
        sm: string;
        md: string;
    };
}, undefined, string[], {
    variant: {
        default: string;
        primary: string;
        outline: string;
        success: string;
        warning: string;
        error: string;
        info: string;
        slate: string;
        gray: string;
        zinc: string;
        neutral: string;
        stone: string;
        red: string;
        orange: string;
        amber: string;
        yellow: string;
        lime: string;
        green: string;
        emerald: string;
        teal: string;
        cyan: string;
        sky: string;
        blue: string;
        indigo: string;
        violet: string;
        purple: string;
        fuchsia: string;
        pink: string;
        rose: string;
    };
    size: {
        sm: string;
        md: string;
    };
}, undefined, tailwind_variants.TVReturnType<{
    variant: {
        default: string;
        primary: string;
        outline: string;
        success: string;
        warning: string;
        error: string;
        info: string;
        slate: string;
        gray: string;
        zinc: string;
        neutral: string;
        stone: string;
        red: string;
        orange: string;
        amber: string;
        yellow: string;
        lime: string;
        green: string;
        emerald: string;
        teal: string;
        cyan: string;
        sky: string;
        blue: string;
        indigo: string;
        violet: string;
        purple: string;
        fuchsia: string;
        pink: string;
        rose: string;
    };
    size: {
        sm: string;
        md: string;
    };
}, undefined, string[], unknown, unknown, undefined>>;

type BadgeVariants = VariantProps<typeof badge>;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariants['variant'];
    size?: BadgeVariants['size'];
}
declare function Badge({ variant, size, className, children, ...props }: BadgeProps): react_jsx_runtime.JSX.Element;

interface ButtonProps extends Omit<ButtonProps$1, 'className' | 'render'>, ButtonVariants {
    render?: RenderProp<ButtonRenderProps>;
    children?: ReactNode;
    className?: string;
    isDisabled?: boolean;
    onPress?: (event: MouseEvent<HTMLElement>) => void;
    preventFocusOnPress?: boolean;
}
interface ButtonRenderProps {
    className: string;
    children: ReactNode;
    [key: string]: unknown;
}
declare function Button({ variant, size, render, preventFocusOnPress: _preventFocusOnPress, nativeButton, isDisabled, disabled, onPress, onClick, className, children, ...props }: ButtonProps): react_jsx_runtime.JSX.Element;

interface CheckboxProps extends Omit<CheckboxRoot.Props, 'checked' | 'defaultChecked' | 'disabled' | 'indeterminate' | 'onCheckedChange' | 'value'> {
    children?: ReactNode;
    label?: string;
    value?: string | boolean;
    isSelected?: boolean;
    defaultSelected?: boolean;
    isDisabled?: boolean;
    isIndeterminate?: boolean;
    onChange?: (selected: boolean) => void;
}
declare function Checkbox({ label, className, children, isSelected, defaultSelected, isDisabled, isIndeterminate, onChange, value, slot, ...props }: CheckboxProps): react_jsx_runtime.JSX.Element;

export interface ButtonProps {
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  disabled?: boolean;
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;

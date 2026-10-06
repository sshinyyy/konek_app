import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#78a189] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#145b43] text-white hover:bg-[#0f4937]",
        destructive: "bg-[#a45442] text-white hover:bg-[#8f4030]",
        outline: "border border-[#e6ebe6] bg-white text-[#4e5e56] hover:bg-[#fbfcfa]",
        secondary: "bg-[#eaf2eb] text-[#145b43] hover:bg-[#e1ece3]",
        ghost: "text-[#56665d] hover:bg-[#f0f4ef]",
        link: "min-h-0 px-0 text-[#145b43] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10",
        sm: "h-8 rounded-md px-3 text-[11px]",
        lg: "h-11 px-5 text-[13px]",
        icon: "h-9 w-9 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

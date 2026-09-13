import { cva, type VariantProps } from "class-variance-authority"

export const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                // 这几个变体原本铺实色（bg-background / bg-secondary），在玻璃面板上
                // 每一行都会印出一块白或一块灰，整页看起来就是灰白条纹。改成叠在
                // 材质上的中性色，并且用中性黑白而不是偏暖的主题 token。
                outline:
                    "border border-foreground/15 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.09]",
                secondary:
                    "bg-black/[0.05] dark:bg-white/[0.08] text-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.12]",
                ghost: "hover:bg-black/[0.05] dark:hover:bg-white/[0.08]",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-md px-3",
                lg: "h-11 rounded-md px-8",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>

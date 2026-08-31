import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function Input({
	className,
	type = "text",
	...props
}: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-base text-ink shadow-sm outline-none transition placeholder:text-ink/35 focus:border-forest focus:ring-4 focus:ring-forest/10 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };

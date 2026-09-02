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
				"h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 text-base text-ink shadow-[0_1px_2px_rgba(0,0,0,0.03)] outline-none transition placeholder:text-ink/35 focus:border-ink/35 focus:ring-4 focus:ring-sky/30 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };

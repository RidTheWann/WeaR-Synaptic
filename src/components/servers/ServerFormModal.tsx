/**
 * Server Form Modal with Zod validation and React Hook Form
 * Supports both stdio and sse transport types
 */

import { useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, X, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ============================================
// ZOD VALIDATION SCHEMA
// ============================================

const envVarSchema = z.object({
    key: z
        .string()
        .min(1, "Key is required")
        .regex(
            /^[A-Za-z_][A-Za-z0-9_]*$/,
            "Must start with letter/underscore, alphanumeric only"
        ),
    value: z.string().min(1, "Value is required"),
});

const argSchema = z.object({
    value: z.string().min(1, "Argument cannot be empty"),
});

export const serverFormSchema = z
    .object({
        name: z
            .string()
            .min(1, "Name is required")
            .max(50, "Name must be 50 characters or less")
            .regex(
                /^[a-zA-Z][a-zA-Z0-9_-]*$/,
                "Must start with letter, alphanumeric with dashes/underscores"
            ),
        transport: z.enum(["stdio", "sse"]),
        command: z.string().optional(),
        args: z.array(argSchema),
        env: z
            .array(envVarSchema)
            .refine(
                (items) => {
                    const keys = items.map((i) => i.key.toUpperCase());
                    return new Set(keys).size === keys.length;
                },
                {
                    message: "Environment variable keys must be unique",
                }
            ),
        url: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.transport === "stdio") {
            if (!data.command || data.command.trim() === "") {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["command"],
                    message: "Command is required for stdio transport",
                });
            }
        }
        if (data.transport === "sse") {
            if (!data.url || data.url.trim() === "") {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["url"],
                    message: "URL is required for SSE transport",
                });
            } else {
                try {
                    new URL(data.url);
                } catch {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["url"],
                        message: "Invalid URL format",
                    });
                }
            }
        }
    });

export type ServerFormData = z.infer<typeof serverFormSchema>;

// ============================================
// COMPONENT PROPS
// ============================================

interface ServerFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string, data: ServerFormData) => Promise<void>;
    editingServer?: { name: string; data: ServerFormData } | null;
    existingNames: string[];
}

// ============================================
// COMPONENT
// ============================================

export function ServerFormModal({
    isOpen,
    onClose,
    onSubmit,
    editingServer,
    existingNames,
}: ServerFormModalProps) {
    const isEditMode = !!editingServer;

    const form = useForm<ServerFormData>({
        resolver: zodResolver(
            serverFormSchema.refine(
                (data) => {
                    if (isEditMode) return true;
                    return !existingNames.includes(data.name);
                },
                {
                    message: "A server with this name already exists",
                    path: ["name"],
                }
            )
        ),
        defaultValues: {
            name: "",
            transport: "stdio",
            command: "",
            args: [],
            env: [],
            url: "",
        },
    });

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = form;

    const argsField = useFieldArray({ control, name: "args" });
    const envField = useFieldArray({ control, name: "env" });

    const transport = watch("transport");

    // Reset form when modal opens/closes or editing changes
    useEffect(() => {
        if (isOpen) {
            if (editingServer) {
                reset(editingServer.data);
            } else {
                reset({
                    name: "",
                    transport: "stdio",
                    command: "",
                    args: [],
                    env: [],
                    url: "",
                });
            }
        }
    }, [isOpen, editingServer, reset]);

    async function handleFormSubmit(data: ServerFormData) {
        try {
            await onSubmit(data.name, data);
            onClose();
        } catch (err) {
            console.error("Failed to save server:", err);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-50 w-full max-w-2xl max-h-[90vh] overflow-auto bg-background border rounded-xl shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b bg-background">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Server className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">
                                {isEditMode ? "Edit Server" : "Add Server"}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Configure MCP server connection
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-6">
                    {/* Server Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Server Name <span className="text-destructive">*</span>
                        </label>
                        <Controller
                            control={control}
                            name="name"
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    placeholder="my-server"
                                    disabled={isEditMode}
                                    className={cn(errors.name && "border-destructive")}
                                />
                            )}
                        />
                        {errors.name && (
                            <p className="text-xs text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    {/* Transport Type */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Transport</label>
                        <Controller
                            control={control}
                            name="transport"
                            render={({ field }) => (
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select transport" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="stdio">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    stdio
                                                </Badge>
                                                <span>Standard I/O (CLI)</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="sse">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    sse
                                                </Badge>
                                                <span>Server-Sent Events (HTTP)</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    {/* Stdio Fields */}
                    {transport === "stdio" && (
                        <>
                            {/* Command */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Command <span className="text-destructive">*</span>
                                </label>
                                <Controller
                                    control={control}
                                    name="command"
                                    render={({ field }) => (
                                        <Input
                                            {...field}
                                            placeholder="npx, uvx, node, python..."
                                            className={cn(errors.command && "border-destructive")}
                                        />
                                    )}
                                />
                                {errors.command && (
                                    <p className="text-xs text-destructive">
                                        {errors.command.message}
                                    </p>
                                )}
                            </div>

                            {/* Arguments */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Arguments</label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => argsField.append({ value: "" })}
                                    >
                                        <Plus className="w-3 h-3 mr-1" />
                                        Add
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {argsField.fields.map((field, index) => (
                                        <div key={field.id} className="flex gap-2">
                                            <Controller
                                                control={control}
                                                name={`args.${index}.value`}
                                                render={({ field }) => (
                                                    <Input
                                                        {...field}
                                                        placeholder={`Argument ${index + 1}`}
                                                        className="flex-1"
                                                    />
                                                )}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => argsField.remove(index)}
                                                className="text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {argsField.fields.length === 0 && (
                                        <p className="text-sm text-muted-foreground py-2 text-center border rounded-md border-dashed">
                                            No arguments configured
                                        </p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* SSE Fields */}
                    {transport === "sse" && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                URL <span className="text-destructive">*</span>
                            </label>
                            <Controller
                                control={control}
                                name="url"
                                render={({ field }) => (
                                    <Input
                                        {...field}
                                        placeholder="http://localhost:3000/sse"
                                        className={cn(errors.url && "border-destructive")}
                                    />
                                )}
                            />
                            {errors.url && (
                                <p className="text-xs text-destructive">{errors.url.message}</p>
                            )}
                        </div>
                    )}

                    {/* Environment Variables */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Environment Variables</label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => envField.append({ key: "", value: "" })}
                            >
                                <Plus className="w-3 h-3 mr-1" />
                                Add
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {envField.fields.map((field, index) => (
                                <div key={field.id} className="flex gap-2">
                                    <Controller
                                        control={control}
                                        name={`env.${index}.key`}
                                        render={({ field }) => (
                                            <Input
                                                {...field}
                                                placeholder="KEY_NAME"
                                                className={cn(
                                                    "w-1/3",
                                                    errors.env?.[index]?.key && "border-destructive"
                                                )}
                                            />
                                        )}
                                    />
                                    <Controller
                                        control={control}
                                        name={`env.${index}.value`}
                                        render={({ field }) => (
                                            <Input
                                                {...field}
                                                placeholder="value"
                                                type="password"
                                                className={cn(
                                                    "flex-1",
                                                    errors.env?.[index]?.value && "border-destructive"
                                                )}
                                            />
                                        )}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => envField.remove(index)}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                            {envField.fields.length === 0 && (
                                <p className="text-sm text-muted-foreground py-2 text-center border rounded-md border-dashed">
                                    No environment variables configured
                                </p>
                            )}
                        </div>
                        {errors.env && !Array.isArray(errors.env) && (
                            <p className="text-xs text-destructive">{errors.env.message}</p>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting
                                ? "Saving..."
                                : isEditMode
                                    ? "Save Changes"
                                    : "Add Server"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

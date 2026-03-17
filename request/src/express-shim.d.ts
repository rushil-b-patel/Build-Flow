declare module "express" {
  export interface Request {
    hostname: string;
    path: string;
  }

  export interface Response {
    set(name: string, value: string): this;
    send(body?: unknown): this;
    status(code: number): this;
  }

  export interface Application {
    get(
      path: string,
      handler: (req: Request, res: Response) => void | Promise<void>
    ): this;
    listen(port: number, handler?: () => void): void;
  }

  export default function express(): Application;
}

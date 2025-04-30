// 无限循环，直到用户输入了有效的名字
while (true)
{
    Console.WriteLine("Please enter your name:");

    // 读取用户输入
    string name = Console.ReadLine();

    // 检查输入是否为空或者只包含空格
    if (!string.IsNullOrWhiteSpace(name))
    {
        // 输入有效，打招呼并跳出循环
        Console.WriteLine("Hello, " + name + "!");
        break;
    }
    else
    {
        // 输入无效，提示重新输入
        Console.WriteLine("Name cannot be empty. Please try again.\n");
    }
}

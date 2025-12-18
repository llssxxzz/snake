package snake.pojo;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Rankinfo {
    // 1. 将主键注解移到这里，并开启自增 (IdType.AUTO)
    @TableId(type = IdType.AUTO)
    private Integer id;
    // 2. username 变回普通字段 (数据库里建议设为 Unique)
    //private String username;
    private int score;
    private Date date;
}
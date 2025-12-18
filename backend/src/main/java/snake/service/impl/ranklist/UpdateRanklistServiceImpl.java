package snake.service.impl.ranklist;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.alibaba.fastjson2.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

import snake.mapper.RankInfoMapper;
import snake.pojo.Rankinfo;
import snake.service.ranklist.UpdateRanklistService;

@Service
public class UpdateRanklistServiceImpl implements UpdateRanklistService {

    @Autowired
    private RankInfoMapper rankInfoMapper;

    @Override
    public Map<String, String> updateRanklist(JSONObject data) {
        //String UserName = data.getString("username");
        Date date = data.getDate("date");
        Integer score = data.getInteger("score");

        Rankinfo rankInfo = new Rankinfo(null, score, date);

        Map<String, String> map = new HashMap<>();

        rankInfoMapper.insert(rankInfo);
        map.put("message", "insert success");
        return map;

    }
}
